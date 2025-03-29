import { JsonObject } from "../../Core/Json";
import anyTrait from "../Decorators/anyTrait";
import objectArrayTrait from "../Decorators/objectArrayTrait";
import objectTrait from "../Decorators/objectTrait";
import primitiveTrait from "../Decorators/primitiveTrait";
import mixTraits from "../mixTraits";
import ModelTraits from "../ModelTraits";
import { traitClass } from "../Trait";
import CatalogMemberTraits from "./CatalogMemberTraits";
import GetCapabilitiesTraits from "./GetCapabilitiesTraits";
import ImageryProviderTraits from "./ImageryProviderTraits";
import LayerOrderingTraits from "./LayerOrderingTraits";
import LegendOwnerTraits from "./LegendOwnerTraits";
import LegendTraits from "./LegendTraits";
import MappableTraits from "./MappableTraits";
import UrlTraits from "./UrlTraits";
import primitiveArrayTrait from "../Decorators/primitiveArrayTrait";
import DiffableTraits from "./DiffableTraits";


// Create new traits class
export class WebMapTileServiceAvailableDimensionTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "Name",
    description: "The name of the dimension."
  })
  name?: string;

  @primitiveTrait({
    type: "string",
    name: "Units",
    description: "The units of the dimension."
  })
  units?: string;

  @primitiveTrait({
    type: "string",
    name: "Unit Symbol",
    description: "The unit symbol of the dimension."
  })
  unitSymbol?: string;

  @primitiveTrait({
    type: "string",
    name: "Default",
    description: "The default value for the dimension."
  })
  default?: string;

  @primitiveTrait({
    type: "boolean",
    name: "Multiple Values",
    description: "Whether multiple values are allowed for this dimension."
  })
  multipleValues?: boolean;

  @primitiveTrait({
    type: "boolean",
    name: "Current",
    description: "Whether the 'current' keyword is supported for this dimension."
  })
  current?: boolean;

  @primitiveTrait({
    type: "boolean",
    name: "Nearest Value",
    description: "Whether nearest value interpolation is supported."
  })
  nearestValue?: boolean;

  @primitiveArrayTrait({
    type: "string",
    name: "Dimension values",
    description: "Possible dimension values."
  })
  values?: string[];
}

export class WebMapTileServiceAvailableLayerDimensionsTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "Layer Name",
    description: "The name of the layer for which dimensions are available."
  })
  layerName?: string;

  @objectArrayTrait({
    type: WebMapTileServiceAvailableDimensionTraits,
    name: "Dimensions",
    description: "The dimensions available for this layer.",
    idProperty: "name"
  })
  dimensions?: WebMapTileServiceAvailableDimensionTraits[];
}

export class WebMapTileServiceAvailableStyleTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "Style Identifier",
    description: "The identifier of the style."
  })
  identifier?: string;

  @primitiveTrait({
    type: "string",
    name: "Title",
    description: "The title of the style."
  })
  title?: string;

  @primitiveTrait({
    type: "string",
    name: "Abstract",
    description: "The abstract describing the style."
  })
  abstract?: string;

  @objectTrait({
    type: LegendTraits,
    name: "Style Name",
    description: "The name of the style."
  })
  legend?: LegendTraits;

  @primitiveTrait({
    type: "string",
    name: "Is Default",
    description: "True if this Style is default; otherwise, false."
  })
  isDefault: boolean = false;
}

export class WebMapTileServiceAvailableLayerStylesTraits extends ModelTraits {
  @primitiveTrait({
    type: "string",
    name: "Layer Name",
    description: "The name of the layer for which styles are available."
  })
  layerName?: string;

  @objectArrayTrait({
    type: WebMapTileServiceAvailableStyleTraits,
    name: "Styles",
    description: "The styles available for this layer.",
    idProperty: "identifier"
  })
  styles?: WebMapTileServiceAvailableStyleTraits[];
}

@traitClass({
  description: `Creates a single item in the catalog from a url that points to a wmts service.`,
  example: {
    type: "wmts",
    id: "a unique id for wmts example",
    name: "wmts example",
    url: "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/WMTS/1.0.0/WMTSCapabilities.xml",
    layer: "Reference_World_Boundaries_and_Places",
    opacity: 1
  }
})
export default class WebMapTileServiceCatalogItemTraits extends mixTraits(
  DiffableTraits,
  LayerOrderingTraits,
  GetCapabilitiesTraits,
  ImageryProviderTraits,
  UrlTraits,
  MappableTraits,
  CatalogMemberTraits,
  LegendOwnerTraits
) {
  @primitiveTrait({
    type: "string",
    name: "Is GeoServer",
    description: "True if this WMS is a GeoServer; otherwise, false."
  })
  isGeoServer: boolean = false;

  @primitiveTrait({
    type: "string",
    name: "Layer",
    description: "The layer to display."
  })
  layer?: string;

  @primitiveTrait({
    type: "string",
    name: "Style",
    description: "The style to use with `Layer`."
  })
  style?: string;

  @objectArrayTrait({
    type: WebMapTileServiceAvailableLayerStylesTraits,
    name: "Available Styles",
    description: "The available styles.",
    idProperty: "layerName"
  })
  availableStyles?: WebMapTileServiceAvailableLayerStylesTraits[];

  @anyTrait({
    name: "Parameters",
    description:
      "Additional parameters to pass to the MapServer when requesting images."
  })
  parameters?: JsonObject;

  @primitiveTrait({
    type: "boolean",
    name: "Enable Pick Features",
    description: "Indicates whether feature picking is enabled."
  })
  enablePickFeatures: boolean = true;
  
  @primitiveTrait({
    type: "number",
    name: "Maximum Refresh Intervals",
    description:
      "The maximum number of discrete times that can be created by a single " +
      "date range, when specified in the format time/time/periodicity. E.g. " +
      "`2015-04-27T16:15:00/2015-04-27T18:45:00/PT15M` has 11 times."
  })
  maxRefreshIntervals: number = 10000;
  
  @anyTrait({
    name: "Dimensions",
    description:
      "Dimension parameters used to request a particular layer along one or more dimensional axes (including elevation, excluding time). Do not include `_dim` prefx for parameter keys. These dimensions will be applied to the layer."
  })
  dimensions?: { [key: string]: string };

  @objectArrayTrait({
    type: WebMapTileServiceAvailableLayerDimensionsTraits,
    name: "Available Dimensions",
    description: "The available dimensions.",
    idProperty: "layerName"
  })
  availableDimensions?: WebMapTileServiceAvailableLayerDimensionsTraits[];
}
