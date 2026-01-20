import i18next from "i18next";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import CesiumMath from "terriajs-cesium/Source/Core/Math";
import { Feature, FeatureCollection, Polygon } from "geojson";
import { runInAction } from "mobx";
import createGuid from "terriajs-cesium/Source/Core/createGuid";
import { isFeatureCollection } from "../../../../Core/GeoJson";
import isDefined from "../../../../Core/isDefined";
import TerriaError from "../../../../Core/TerriaError";
import GeoJsonCatalogItem from "../../../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import CommonStrata from "../../../../Models/Definition/CommonStrata";
import createStratumInstance from "../../../../Models/Definition/createStratumInstance";
import Terria from "../../../../Models/Terria";
import TableColorStyleTraits from "../../../../Traits/TraitsClasses/Table/ColorStyleTraits";
import TableStyleTraits from "../../../../Traits/TraitsClasses/Table/StyleTraits";

/**
 * Convert an array of Cartesian3 positions to GeoJSON Polygon coordinates (lon/lat).
 * Closes the polygon by repeating the first point at the end.
 */
export function cartesian3ArrayToPolygonCoordinates(
  positions: Cartesian3[]
): number[][] {
  const coordinates: number[][] = [];

  for (let i = 0; i < positions.length; i++) {
    const cartographic = Ellipsoid.WGS84.cartesianToCartographic(positions[i]);
    coordinates.push([
      CesiumMath.toDegrees(cartographic.longitude),
      CesiumMath.toDegrees(cartographic.latitude)
    ]);
  }

  // Close the polygon by repeating the first point
  if (coordinates.length > 0) {
    coordinates.push([coordinates[0][0], coordinates[0][1]]);
  }

  return coordinates;
}

/**
 * Find all GeoJsonCatalogItem instances from workbench that could be annotation areas.
 * Returns items that have FeatureCollection data (user-created annotations).
 */
export function findAnnotationGeoJsonItems(
  terria: Terria
): GeoJsonCatalogItem[] {
  const candidates = [
    ...terria.workbench.items,
    ...terria.catalog.userAddedDataGroup.memberModels
  ];

  const byId = new Map<string, GeoJsonCatalogItem>();

  candidates.forEach((item: any) => {
    if (item.type !== "geojson" || !isDefined(item.uniqueId)) {
      return;
    }
    if (byId.has(item.uniqueId)) {
      return;
    }
    const geoJsonItem = item as GeoJsonCatalogItem;
    if (isDefined(geoJsonItem.geoJsonData)) {
      byId.set(item.uniqueId, geoJsonItem);
    }
  });

  return Array.from(byId.values());
}

/**
 * Get or create an annotation GeoJsonCatalogItem by ID.
 * If ID is not provided or item not found, creates a new one with empty FeatureCollection.
 */
export function getOrCreateAnnotationItem(
  terria: Terria,
  targetItemId: string | null,
  defaultName: string
): GeoJsonCatalogItem {
  if (targetItemId) {
    const existing = terria.getModelById(GeoJsonCatalogItem, targetItemId);
    if (existing) {
      return existing;
    }
  }

  // Create new annotation item
  const item = new GeoJsonCatalogItem(createGuid(), terria);

  runInAction(() => {
    item.setTrait(CommonStrata.user, "name", defaultName);
    item.setTrait(CommonStrata.user, "geoJsonData", {
      type: "FeatureCollection",
      features: []
    } as any);
    terria.addModel(item);
    terria.catalog.userAddedDataGroup.setTrait(
      CommonStrata.user,
      "isOpen",
      true
    );
    terria.catalog.userAddedDataGroup.add(CommonStrata.user, item);
  });

  void terria.workbench
    .add(item)
    .then((result) => result.throwIfError?.())
    .catch((error) =>
      terria.raiseErrorToUser(
        TerriaError.from(error, {
          title: i18next.t("annotation.errorTitle"),
          message: i18next.t("annotation.errorMessage")
        })
      )
    );

  return item;
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collect all feature names from a GeoJsonCatalogItem's FeatureCollection.
 */
function collectFeatureNames(item: GeoJsonCatalogItem): string[] {
  const data = item.geoJsonData;
  if (!isFeatureCollection(data)) {
    return [];
  }

  return data.features
    .map((f) => (f as any)?.properties?.name)
    .filter((n): n is string => typeof n === "string");
}

/**
 * Collect all used numbers from names matching the pattern "baseName N".
 * Used by both ensureUniqueName and generateDefaultAnnotationName for consistency.
 */
function collectUsedNumbers(
  names: string[],
  baseName: string
): Set<number> {
  const usedNumbers = new Set<number>();
  const pattern = new RegExp(`^${escapeForRegex(baseName)}\\s+(\\d+)$`, "i");
  
  names.forEach((name) => {
    const match = name.match(pattern);
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num)) {
        usedNumbers.add(num);
      }
    }
  });
  
  return usedNumbers;
}

/**
 * Find the next available number for a given base name pattern.
 * This is the unified logic for generating unique sequential names.
 */
function findNextAvailableNumber(
  usedNumbers: Set<number>,
  startFrom: number = 1
): number {
  let candidate = startFrom;
  while (usedNumbers.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Ensure a feature name is unique within the given set of existing names.
 * If the name already exists, appends a number suffix: "Name 2", "Name 3", etc.
 * Uses the same sequential pattern as generateDefaultAnnotationName for consistency.
 */
function ensureUniqueName(name: string, existingNames: Set<string>): string {
  if (!existingNames.has(name)) {
    return name;
  }

  // Collect numbers already used with this base name
  const usedNumbers = collectUsedNumbers(Array.from(existingNames), name);
  // Also mark 1 as used since the original name without number exists
  usedNumbers.add(1);
  
  const nextNumber = findNextAvailableNumber(usedNumbers, 2);
  return `${name} ${nextNumber}`;
}

/**
 * Append a new Feature (polygon) to an existing GeoJsonCatalogItem's FeatureCollection.
 * Ensures the feature name is unique within the item to prevent legend/color collisions.
 * Colors and legend are handled automatically by the TableColorMap and ColorStyleLegend.
 */
export function appendFeatureToGeoJsonItem(
  item: GeoJsonCatalogItem,
  polygonCoordinates: number[][],
  featureName: string
): void {
  const currentGeoJsonData = item.geoJsonData;

  // Ensure we have a FeatureCollection
  const featureCollection: FeatureCollection = isFeatureCollection(
    currentGeoJsonData
  )
    ? (currentGeoJsonData as FeatureCollection)
    : { type: "FeatureCollection", features: [] };

  // Ensure unique name within item to prevent duplicate legend entries
  const existingNames = new Set(collectFeatureNames(item));
  const uniqueName = ensureUniqueName(featureName, existingNames);

  // Create new polygon feature
  const polygon: Polygon = {
    type: "Polygon",
    coordinates: [polygonCoordinates]
  };

  const newFeature: Feature = {
    type: "Feature",
    geometry: polygon,
    properties: {
      name: uniqueName
    }
  };

  // Append the new feature
  const updatedFeatures = [...(featureCollection.features || []), newFeature];
  const updatedFeatureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: updatedFeatures
  };

  runInAction(() => {
    item.setTrait(CommonStrata.user, "geoJsonData", updatedFeatureCollection as any);
    // Color by name - EnumColorMap and ColorStyleLegend handle colors/legend automatically
    if (!item.defaultStyle?.color?.colorColumn) {
      item.setTrait(
        CommonStrata.user,
        "defaultStyle",
        createStratumInstance(TableStyleTraits, {
          hidden: false,
          color: createStratumInstance(TableColorStyleTraits, {
            colorColumn: "name",
            mapType: "enum"
          })
        })
      );
    }
  });
}

/**
 * Generate default annotation name avoiding collisions with existing items and features.
 * Scans all annotation items and their features for names matching "baseName N" pattern.
 * Uses the same sequential naming pattern as ensureUniqueName for consistency.
 */
export function generateDefaultAnnotationName(
  targetItem: GeoJsonCatalogItem | null,
  terria?: Terria | null,
  baseName: string = "Drawn area"
): string {
  const allNames: string[] = [];
  const processed = new Set<string>();
  let featureCount = 0;

  const collectFromItem = (item: GeoJsonCatalogItem) => {
    const key = item.uniqueId ?? item.name;
    if (key && processed.has(key)) {
      return;
    }
    if (key) {
      processed.add(key);
    }

    // Collect item name and all feature names
    if (item.name) {
      allNames.push(item.name);
    }
    allNames.push(...collectFeatureNames(item));
  };

  // Gather names across all annotation items (and their features) to avoid collisions.
  if (terria) {
    findAnnotationGeoJsonItems(terria).forEach(collectFromItem);
  }

  // Also gather names from the target item.
  if (targetItem) {
    collectFromItem(targetItem);

    const geoJsonData = targetItem.geoJsonData;
    if (isFeatureCollection(geoJsonData)) {
      featureCount = geoJsonData.features.length;
    }
  }

  // Use unified number finding logic
  const usedNumbers = collectUsedNumbers(allNames, baseName);
  const startFrom = (targetItem ? featureCount : 0) + 1;
  const nextNumber = findNextAvailableNumber(usedNumbers, startFrom);

  return `${baseName} ${nextNumber}`;
}
