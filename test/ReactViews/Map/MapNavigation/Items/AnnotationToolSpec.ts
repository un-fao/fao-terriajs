import { runInAction } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Cartographic from "terriajs-cesium/Source/Core/Cartographic";
import Ellipsoid from "terriajs-cesium/Source/Core/Ellipsoid";
import PickedFeatures from "../../../../../lib/Map/PickedFeatures/PickedFeatures";
import TerriaFeature from "../../../../../lib/Models/Feature/Feature";
import Terria from "../../../../../lib/Models/Terria";
import { AnnotationTool } from "../../../../../lib/ReactViews/Map/MapNavigation/Items/AnnotationTool";
import GeoJsonCatalogItem from "../../../../../lib/Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import {
  cartesian3ArrayToPolygonCoordinates,
  generateDefaultAnnotationName,
  appendFeatureToGeoJsonItem,
  getOrCreateAnnotationItem,
  findAnnotationGeoJsonItems
} from "../../../../../lib/ReactViews/Map/MapNavigation/Items/AnnotationHelpers";
import CommonStrata from "../../../../../lib/Models/Definition/CommonStrata";

describe("AnnotationTool", function () {
  let terria: Terria;

  beforeEach(function () {
    terria = new Terria();
  });

  it("converts Cartesian3 positions to closed polygon coordinates", function () {
    const positions: Cartesian3[] = [];
    // Create 3 points forming a triangle
    const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
      Cartographic.fromDegrees(149.121, -35.309, 0)
    );
    const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
      Cartographic.fromDegrees(149.124, -35.311, 0)
    );
    const pt3 = Ellipsoid.WGS84.cartographicToCartesian(
      Cartographic.fromDegrees(149.127, -35.308, 0)
    );

    positions.push(pt1, pt2, pt3);

    const coordinates = cartesian3ArrayToPolygonCoordinates(positions);

    // Should have 4 coordinates (3 points + closing point)
    expect(coordinates.length).toBe(4);
    // First and last should be the same (closed polygon)
    expect(coordinates[0][0]).toBeCloseTo(coordinates[3][0], 5);
    expect(coordinates[0][1]).toBeCloseTo(coordinates[3][1], 5);

    // Verify lon/lat values are in degrees
    expect(coordinates[0][0]).toBeCloseTo(149.121, 5);
    expect(coordinates[0][1]).toBeCloseTo(-35.309, 5);
  });

  it("generates default annotation names correctly", function () {
    const item1 = generateDefaultAnnotationName(null, terria);
    expect(item1).toBe("Drawn area 1");

    // Create an item with existing features
    const geoJsonItem = new GeoJsonCatalogItem("test-id", terria);
    runInAction(() => {
      geoJsonItem.setTrait(CommonStrata.user, "name", "Test Area");
      geoJsonItem.setTrait(CommonStrata.user, "geoJsonData", {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
            properties: { name: "Feature 1" }
          },
          {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]] },
            properties: { name: "Feature 2" }
          }
        ]
      });
    });

    const item2 = generateDefaultAnnotationName(geoJsonItem, terria);
    expect(item2).toBe("Drawn area 3"); // 2 existing features + 1 new
  });

  it("generates unique default names across existing areas", function () {
    const first = new GeoJsonCatalogItem("id-1", terria);
    const second = new GeoJsonCatalogItem("id-2", terria);

    runInAction(() => {
      first.setTrait(CommonStrata.user, "name", "Drawn area 1");
      second.setTrait(CommonStrata.user, "name", "Drawn area 2");
      terria.addModel(first);
      terria.addModel(second);
      terria.workbench.add(first);
      terria.workbench.add(second);
    });

    const next = generateDefaultAnnotationName(null, terria);
    expect(next).toBe("Drawn area 3");
  });

  it("creates a new GeoJsonCatalogItem when target is null", function () {
    const item = getOrCreateAnnotationItem(terria, null, "New Area");
    expect(item).toBeDefined();
    expect(item.name).toBe("New Area");
    expect(item.type).toBe("geojson");
    expect(terria.workbench.items).toContain(item);
    expect(terria.catalog.userAddedDataGroup.memberModels).toContain(item);
  });

  it("finds existing GeoJsonCatalogItem when target ID is provided", function () {
    const existingItem = new GeoJsonCatalogItem("existing-id", terria);
    runInAction(() => {
      existingItem.setTrait(CommonStrata.user, "name", "Existing Area");
      terria.addModel(existingItem);
    });

    const foundItem = getOrCreateAnnotationItem(terria, "existing-id", "New Area");
    expect(foundItem).toBe(existingItem);
    expect(foundItem.name).toBe("Existing Area");
  });

  it("appends feature to existing FeatureCollection", function () {
    const item = new GeoJsonCatalogItem("test-id", terria);
    runInAction(() => {
      item.setTrait(CommonStrata.user, "geoJsonData", {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
            properties: { name: "Feature 1" }
          }
        ]
      });
    });

    const newCoordinates = [
      [2, 2],
      [3, 2],
      [3, 3],
      [2, 3],
      [2, 2]
    ];

    appendFeatureToGeoJsonItem(item, newCoordinates, "Feature 2");

    const geoJsonData = item.geoJsonData as any;
    expect(geoJsonData.type).toBe("FeatureCollection");
    expect(geoJsonData.features.length).toBe(2);
    expect(geoJsonData.features[0].properties.name).toBe("Feature 1");
    expect(geoJsonData.features[1].properties.name).toBe("Feature 2");
    expect(geoJsonData.features[1].geometry.type).toBe("Polygon");
    expect(geoJsonData.features[1].geometry.coordinates[0]).toEqual(newCoordinates);
  });

  it("creates FeatureCollection if item has no geoJsonData", function () {
    const item = new GeoJsonCatalogItem("test-id", terria);
    
    const coordinates = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0]
    ];

    appendFeatureToGeoJsonItem(item, coordinates, "New Feature");

    const geoJsonData = item.geoJsonData as any;
    expect(geoJsonData.type).toBe("FeatureCollection");
    expect(geoJsonData.features.length).toBe(1);
    expect(geoJsonData.features[0].properties.name).toBe("New Feature");
  });

  describe("AnnotationTool integration", function () {
    const mockOnClose = jasmine.createSpy("onClose");

    beforeEach(function () {
      mockOnClose.calls.reset();
    });

    it("instantiates correctly", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      expect(tool).toBeDefined();
      expect(tool.targetItemId).toBeNull();
      // nameInput starts empty; default is derived at persist time
      expect(tool.nameInput).toBe("");
      expect(tool.itemRef).toBeDefined();
    });

    it("preserves user-entered name when switching target", function () {
      const existingItem = new GeoJsonCatalogItem("existing-id", terria);
      runInAction(() => {
        terria.addModel(existingItem);
      });

      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      tool.handleNameChange("Custom name");
      tool.handleTargetChange("existing-id");

      // Name stays as user entered; no auto-reset
      expect(tool.nameInput).toBe("Custom name");
    });

    it("does not persist polygon if less than 3 points", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      const initialWorkbenchLength = terria.workbench.items.length;

      // Simulate drawing with only 2 points
      const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.121, -35.309, 0)
      );
      const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.124, -35.311, 0)
      );

      tool.onDrawingComplete({ points: [pt1, pt2] });

      // Should not create new item
      expect(terria.workbench.items.length).toBe(initialWorkbenchLength);
    });

    it("does not persist polygon if not closed", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      const initialWorkbenchLength = terria.workbench.items.length;

      // Simulate drawing with 3 points but not closed
      const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.121, -35.309, 0)
      );
      const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.124, -35.311, 0)
      );
      const pt3 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.127, -35.308, 0)
      );

      // Set closeLoop to false
      (tool as any).userDrawing.closeLoop = false;
      tool.onDrawingComplete({ points: [pt1, pt2, pt3] });

      // Should not create new item
      expect(terria.workbench.items.length).toBe(initialWorkbenchLength);
    });

    it("persists polygon when valid and closed", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      const initialWorkbenchLength = terria.workbench.items.length;

      // Simulate drawing with 3 points forming a closed triangle
      const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.121, -35.309, 0)
      );
      const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.124, -35.311, 0)
      );
      const pt3 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.127, -35.308, 0)
      );

      // Set closeLoop to true
      (tool as any).userDrawing.closeLoop = true;
      tool.targetItemId = null;
      tool.nameInput = "Test Polygon";

      tool.onDrawingComplete({ points: [pt1, pt2, pt3] });

      // Should create new item
      expect(terria.workbench.items.length).toBe(initialWorkbenchLength + 1);
      const createdItem = terria.workbench.items[
        terria.workbench.items.length - 1
      ] as GeoJsonCatalogItem;
      expect(createdItem.type).toBe("geojson");
      expect(terria.catalog.userAddedDataGroup.memberModels).toContain(
        createdItem
      );

      const geoJsonData = createdItem.geoJsonData as any;
      expect(geoJsonData.type).toBe("FeatureCollection");
      expect(geoJsonData.features.length).toBe(1);
      expect(geoJsonData.features[0].properties.name).toBe("Test Polygon");
    });

    it("appends to existing item when targetItemId is set", function () {
      // Create existing item
      const existingItem = new GeoJsonCatalogItem("existing-id", terria);
      runInAction(() => {
        existingItem.setTrait(CommonStrata.user, "name", "Existing Area");
        existingItem.setTrait(CommonStrata.user, "geoJsonData", {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0]
                  ]
                ]
              },
              properties: { name: "First Feature" }
            }
          ]
        });
        terria.addModel(existingItem);
        terria.workbench.add(existingItem);
      });

      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.121, -35.309, 0)
      );
      const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.124, -35.311, 0)
      );
      const pt3 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.127, -35.308, 0)
      );

      (tool as any).userDrawing.closeLoop = true;
      tool.targetItemId = "existing-id";
      tool.nameInput = "Second Feature";

      tool.onDrawingComplete({ points: [pt1, pt2, pt3] });

      // Should append to existing item, not create new one
      expect(terria.workbench.items.length).toBe(1);
      const geoJsonData = existingItem.geoJsonData as any;
      expect(geoJsonData.features.length).toBe(2);
      expect(geoJsonData.features[0].properties.name).toBe("First Feature");
      expect(geoJsonData.features[1].properties.name).toBe("Second Feature");
      expect(terria.workbench.items).toContain(existingItem);
    });

    it("calls onClose when cleaning up", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      tool.onCleanUp();

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("resets state when activated", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      // Set some state
      tool.handleNameChange("Custom name");
      tool.handleAddToExistingChange(true);

      expect(tool.nameInput).toBe("Custom name");
      expect(tool.addToExisting).toBe(true);

      // Activate should reset
      tool.activate();

      expect(tool.nameInput).toBe("");
      expect(tool.addToExisting).toBe(false);
      expect(tool.targetItemId).toBeNull();
    });

    it("resets state when deactivated via cleanup", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      tool.handleNameChange("My Area");
      tool.onCleanUp();

      expect(tool.nameInput).toBe("");
      expect(tool.addToExisting).toBe(false);
    });
  });

  describe("UserDrawing integration", function () {
    const mockOnClose = jasmine.createSpy("onClose");

    beforeEach(function () {
      mockOnClose.calls.reset();
    });

    it("enters drawing mode on activate and creates map interaction mode", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      expect(terria.mapInteractionModeStack.length).toBe(0);

      tool.activate();

      expect(terria.mapInteractionModeStack.length).toBe(1);
      expect(terria.allowFeatureInfoRequests).toBe(false);
    });

    it("exits drawing mode on deactivate", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      tool.activate();
      expect(terria.mapInteractionModeStack.length).toBe(1);

      tool.deactivate();

      // Stack should be cleaned up
      expect(terria.allowFeatureInfoRequests).toBe(true);
    });

    it("simulates full drawing flow with point picking", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      tool.activate();

      // Simulate picking first point
      const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.121, -35.309, 0)
      );
      const pickedFeatures1 = new PickedFeatures();
      pickedFeatures1.pickPosition = pt1;

      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures1;
      });

      // UserDrawing should have added a point
      const userDrawing = (tool as any).userDrawing;
      expect(userDrawing.pointEntities.entities.values.length).toBe(1);

      // Simulate picking second point
      const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.124, -35.311, 0)
      );
      const pickedFeatures2 = new PickedFeatures();
      pickedFeatures2.pickPosition = pt2;

      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures2;
      });

      expect(userDrawing.pointEntities.entities.values.length).toBe(2);

      // Simulate picking third point
      const pt3 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.127, -35.308, 0)
      );
      const pickedFeatures3 = new PickedFeatures();
      pickedFeatures3.pickPosition = pt3;

      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures3;
      });

      expect(userDrawing.pointEntities.entities.values.length).toBe(3);
    });

    it("closes polygon when first point is clicked again", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      tool.activate();
      const userDrawing = (tool as any).userDrawing;

      // Add three points
      const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.121, -35.309, 0)
      );
      const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.124, -35.311, 0)
      );
      const pt3 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.127, -35.308, 0)
      );

      const pickedFeatures = new PickedFeatures();

      pickedFeatures.pickPosition = pt1;
      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
      });

      pickedFeatures.pickPosition = pt2;
      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
      });

      pickedFeatures.pickPosition = pt3;
      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
      });

      expect(userDrawing.closeLoop).toBe(false);

      // Click first point again to close the loop
      pickedFeatures.pickPosition = pt1;
      const pt1Entity = userDrawing.pointEntities.entities.values[0];
      pickedFeatures.features = [pt1Entity as TerriaFeature];

      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
      });

      expect(userDrawing.closeLoop).toBe(true);
    });
  });

  describe("findAnnotationGeoJsonItems", function () {
    it("finds GeoJSON items from workbench", function () {
      const item1 = new GeoJsonCatalogItem("item-1", terria);
      const item2 = new GeoJsonCatalogItem("item-2", terria);

      runInAction(() => {
        item1.setTrait(CommonStrata.user, "name", "Area 1");
        item1.setTrait(CommonStrata.user, "geoJsonData", {
          type: "FeatureCollection",
          features: []
        });
        item2.setTrait(CommonStrata.user, "name", "Area 2");
        item2.setTrait(CommonStrata.user, "geoJsonData", {
          type: "FeatureCollection",
          features: []
        });
        terria.addModel(item1);
        terria.addModel(item2);
        terria.workbench.add(item1);
        terria.workbench.add(item2);
      });

      const items = findAnnotationGeoJsonItems(terria);
      expect(items.length).toBe(2);
      expect(items).toContain(item1);
      expect(items).toContain(item2);
    });

    it("excludes items without geoJsonData", function () {
      const itemWithData = new GeoJsonCatalogItem("with-data", terria);
      const itemWithoutData = new GeoJsonCatalogItem("without-data", terria);

      runInAction(() => {
        itemWithData.setTrait(CommonStrata.user, "geoJsonData", {
          type: "FeatureCollection",
          features: []
        });
        terria.addModel(itemWithData);
        terria.addModel(itemWithoutData);
        terria.workbench.add(itemWithData);
        terria.workbench.add(itemWithoutData);
      });

      const items = findAnnotationGeoJsonItems(terria);
      expect(items.length).toBe(1);
      expect(items).toContain(itemWithData);
    });

    it("deduplicates items appearing in both workbench and userAddedDataGroup", function () {
      const item = new GeoJsonCatalogItem("duplicate-item", terria);

      runInAction(() => {
        item.setTrait(CommonStrata.user, "geoJsonData", {
          type: "FeatureCollection",
          features: []
        });
        terria.addModel(item);
        terria.workbench.add(item);
        terria.catalog.userAddedDataGroup.add(CommonStrata.user, item);
      });

      const items = findAnnotationGeoJsonItems(terria);
      expect(items.length).toBe(1);
    });
  });

  describe("Name uniqueness", function () {
    it("ensures unique names when adding duplicate feature names", function () {
      const item = new GeoJsonCatalogItem("test-id", terria);
      runInAction(() => {
        item.setTrait(CommonStrata.user, "geoJsonData", {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0]
                  ]
                ]
              },
              properties: { name: "Test Area" }
            }
          ]
        });
      });

      // Add another feature with the same name
      appendFeatureToGeoJsonItem(
        item,
        [
          [2, 2],
          [3, 2],
          [3, 3],
          [2, 3],
          [2, 2]
        ],
        "Test Area"
      );

      const geoJsonData = item.geoJsonData as any;
      expect(geoJsonData.features.length).toBe(2);
      expect(geoJsonData.features[0].properties.name).toBe("Test Area");
      // Second feature should have unique name
      expect(geoJsonData.features[1].properties.name).toBe("Test Area 2");
    });

    it("handles sequential duplicate names correctly", function () {
      const item = new GeoJsonCatalogItem("test-id", terria);
      runInAction(() => {
        item.setTrait(CommonStrata.user, "geoJsonData", {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                    [0, 0]
                  ]
                ]
              },
              properties: { name: "Area" }
            },
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [1, 1],
                    [2, 1],
                    [2, 2],
                    [1, 2],
                    [1, 1]
                  ]
                ]
              },
              properties: { name: "Area 2" }
            }
          ]
        });
      });

      // Add another "Area" - should become "Area 3" since "Area 2" exists
      appendFeatureToGeoJsonItem(
        item,
        [
          [3, 3],
          [4, 3],
          [4, 4],
          [3, 4],
          [3, 3]
        ],
        "Area"
      );

      const geoJsonData = item.geoJsonData as any;
      expect(geoJsonData.features.length).toBe(3);
      expect(geoJsonData.features[2].properties.name).toBe("Area 3");
    });

    it("generates correct default names with gaps in sequence", function () {
      const item1 = new GeoJsonCatalogItem("id-1", terria);
      const item3 = new GeoJsonCatalogItem("id-3", terria);

      runInAction(() => {
        item1.setTrait(CommonStrata.user, "name", "Drawn area 1");
        item3.setTrait(CommonStrata.user, "name", "Drawn area 3");
        terria.addModel(item1);
        terria.addModel(item3);
        terria.workbench.add(item1);
        terria.workbench.add(item3);
      });

      // Should fill the gap and use "Drawn area 2"
      const next = generateDefaultAnnotationName(null, terria);
      expect(next).toBe("Drawn area 2");
    });
  });

  describe("GeoJSON styling", function () {
    it("sets color styling when appending first feature", function () {
      const item = new GeoJsonCatalogItem("test-id", terria);

      appendFeatureToGeoJsonItem(
        item,
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0]
        ],
        "Feature 1"
      );

      expect(item.defaultStyle?.color?.colorColumn).toBe("name");
      expect(item.defaultStyle?.color?.mapType).toBe("enum");
    });

    it("preserves existing color styling when appending features", function () {
      const item = new GeoJsonCatalogItem("test-id", terria);

      // Add first feature - sets styling
      appendFeatureToGeoJsonItem(
        item,
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0]
        ],
        "Feature 1"
      );

      const originalStyle = item.defaultStyle;

      // Add second feature - should not change styling
      appendFeatureToGeoJsonItem(
        item,
        [
          [2, 2],
          [3, 2],
          [3, 3],
          [2, 3],
          [2, 2]
        ],
        "Feature 2"
      );

      expect(item.defaultStyle?.color?.colorColumn).toBe("name");
      expect(item.defaultStyle?.color?.mapType).toBe("enum");
    });
  });

  describe("Complete workflow", function () {
    const mockOnClose = jasmine.createSpy("onClose");

    beforeEach(function () {
      mockOnClose.calls.reset();
    });

    it("full workflow: activate, draw, persist, reset", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      // 1. Activate the tool
      tool.activate();
      expect(terria.mapInteractionModeStack.length).toBe(1);

      // 2. Set a custom name
      tool.handleNameChange("My Custom Area");

      // 3. Simulate a closed polygon drawing
      const userDrawing = (tool as any).userDrawing;
      userDrawing.closeLoop = true;

      // Add 3 entities to satisfy canPersist
      const pt1 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.121, -35.309, 0)
      );
      const pt2 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.124, -35.311, 0)
      );
      const pt3 = Ellipsoid.WGS84.cartographicToCartesian(
        Cartographic.fromDegrees(149.127, -35.308, 0)
      );

      // Manually add entities for testing
      const pickedFeatures = new PickedFeatures();
      pickedFeatures.pickPosition = pt1;
      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
      });

      pickedFeatures.pickPosition = pt2;
      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
      });

      pickedFeatures.pickPosition = pt3;
      runInAction(() => {
        terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
      });

      // 4. Complete the drawing
      tool.onDrawingComplete({ points: [pt1, pt2, pt3] });

      // 5. Verify item was created and persisted
      expect(terria.workbench.items.length).toBeGreaterThan(0);
      const createdItem = terria.workbench.items[
        terria.workbench.items.length - 1
      ] as GeoJsonCatalogItem;
      expect(createdItem.type).toBe("geojson");

      const geoJsonData = createdItem.geoJsonData as any;
      expect(geoJsonData.type).toBe("FeatureCollection");
      expect(geoJsonData.features.length).toBe(1);
      expect(geoJsonData.features[0].properties.name).toBe("My Custom Area");

      // 6. Verify tool state was updated (targetItemId set for next draw)
      expect(tool.targetItemId).toBe(createdItem.uniqueId ?? null);
      expect(tool.nameInput).toBe(""); // Reset after persist
    });

    it("multiple drawings to same area accumulate features", function () {
      const tool = new AnnotationTool({
        terria,
        onClose: mockOnClose
      });

      tool.activate();

      const userDrawing = (tool as any).userDrawing;
      userDrawing.closeLoop = true;

      // First drawing
      const pts1 = [
        Ellipsoid.WGS84.cartographicToCartesian(
          Cartographic.fromDegrees(149.121, -35.309, 0)
        ),
        Ellipsoid.WGS84.cartographicToCartesian(
          Cartographic.fromDegrees(149.124, -35.311, 0)
        ),
        Ellipsoid.WGS84.cartographicToCartesian(
          Cartographic.fromDegrees(149.127, -35.308, 0)
        )
      ];

      // Simulate point picking
      const pickedFeatures = new PickedFeatures();
      pts1.forEach((pt) => {
        pickedFeatures.pickPosition = pt;
        runInAction(() => {
          terria.mapInteractionModeStack[0].pickedFeatures = pickedFeatures;
        });
      });

      tool.handleNameChange("First Area");
      tool.onDrawingComplete({ points: pts1 });

      const item = terria.workbench.items[
        terria.workbench.items.length - 1
      ] as GeoJsonCatalogItem;
      expect((item.geoJsonData as any).features.length).toBe(1);

      // Second drawing - addToExisting mode
      tool.handleAddToExistingChange(true);
      tool.handleNameChange("Second Feature");

      const pts2 = [
        Ellipsoid.WGS84.cartographicToCartesian(
          Cartographic.fromDegrees(149.130, -35.305, 0)
        ),
        Ellipsoid.WGS84.cartographicToCartesian(
          Cartographic.fromDegrees(149.133, -35.307, 0)
        ),
        Ellipsoid.WGS84.cartographicToCartesian(
          Cartographic.fromDegrees(149.136, -35.304, 0)
        )
      ];

      tool.onDrawingComplete({ points: pts2 });

      // Should have added to existing item
      expect((item.geoJsonData as any).features.length).toBe(2);
      expect((item.geoJsonData as any).features[0].properties.name).toBe(
        "First Area"
      );
      expect((item.geoJsonData as any).features[1].properties.name).toBe(
        "Second Feature"
      );
    });
  });
});
