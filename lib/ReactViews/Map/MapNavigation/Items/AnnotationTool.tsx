import i18next from "i18next";
import React, { RefObject, createRef } from "react";
import { action, makeObservable, observable, runInAction } from "mobx";
import Cartesian3 from "terriajs-cesium/Source/Core/Cartesian3";
import Terria from "../../../../Models/Terria";
import UserDrawing from "../../../../Models/UserDrawing";
import ViewerMode from "../../../../Models/ViewerMode";
import { GLYPHS } from "../../../../Styled/Icon";
import MapNavigationItemController from "../../../../ViewModels/MapNavigation/MapNavigationItemController";
import GeoJsonCatalogItem from "../../../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import {
  cartesian3ArrayToPolygonCoordinates,
  getOrCreateAnnotationItem,
  appendFeatureToGeoJsonItem,
  generateDefaultAnnotationName,
  findAnnotationGeoJsonItems
} from "./AnnotationHelpers";
import { AnnotationDialog } from "./AnnotationDialog";

interface AnnotationToolOptions {
  terria: Terria;
  onClose(): void;
}

export class AnnotationTool extends MapNavigationItemController {
  static id = "annotation-tool";
  static displayName = "AnnotationTool";

  private readonly terria: Terria;
  private userDrawing: UserDrawing;

  onClose: () => void;
  itemRef: RefObject<HTMLDivElement> = createRef();

  @observable targetItemId: string | null = null;
  @observable addToExisting: boolean = false;
  @observable nameInput: string = ""; // User input; empty = use auto-generated

  constructor(props: AnnotationToolOptions) {
    super();
    makeObservable(this);
    this.terria = props.terria;
    this.onClose = props.onClose;

    this.userDrawing = new UserDrawing({
      terria: props.terria,
      messageHeader: () => i18next.t("annotation.drawingTool"),
      allowPolygon: true,
      onDrawingComplete: this.onDrawingComplete.bind(this),
      onCleanUp: this.onCleanUp.bind(this),
      customUi: () => this.renderDialog()
    });
  }

  get glyph(): any {
    return GLYPHS.editor;
  }

  get viewerMode(): ViewerMode | undefined {
    return undefined;
  }

  /** Get all available annotation items */
  private get availableItems(): GeoJsonCatalogItem[] {
    return findAnnotationGeoJsonItems(this.terria);
  }

  /** Get the selected target item (if addToExisting and valid selection) */
  private get selectedTargetItem(): GeoJsonCatalogItem | null {
    if (!this.addToExisting || !this.targetItemId) {
      return null;
    }
    return this.availableItems.find((item) => item.uniqueId === this.targetItemId) ?? null;
  }

  /** Resolved name: user input or auto-generated */
  private get name(): string {
    return (
      this.nameInput.trim() ||
      generateDefaultAnnotationName(this.selectedTargetItem, this.terria)
    );
  }

  /** Check if current drawing can be persisted as annotation */
  private get canPersist(): boolean {
    const pointCount = this.userDrawing.pointEntities.entities.values.length;
    return this.userDrawing.closeLoop && pointCount >= 3;
  }

  @action.bound
  handleTargetChange(selectedId: string) {
    const normalizedId = (selectedId ?? "").trim();
    const matchedItem =
      normalizedId.length === 0
        ? null
        : this.availableItems.find((item) => item.uniqueId === normalizedId) ?? null;

    this.targetItemId = matchedItem?.uniqueId ?? null;
  }

  @action.bound
  handleNameChange(value: string) {
    this.nameInput = value;
  }

  @action.bound
  handleAddToExistingChange(addToExisting: boolean) {
    this.addToExisting = addToExisting;

    if (addToExisting) {
      const [firstItem] = this.availableItems;
      this.targetItemId = firstItem?.uniqueId ?? null;
    } else {
      this.targetItemId = null;
    }
  }

  renderDialog = () => {
    return (
      <AnnotationDialog
        availableItems={this.availableItems}
        targetItemId={this.targetItemId}
        addToExisting={this.addToExisting}
        nameInput={this.nameInput}
        placeholder={this.name}
        onTargetChange={this.handleTargetChange}
        onNameChange={this.handleNameChange}
        onAddToExistingChange={this.handleAddToExistingChange}
      />
    );
  };

  onDrawingComplete(params: { points: Cartesian3[]; rectangle?: any }) {
    if (!this.canPersist) return;

    const polygonCoordinates = cartesian3ArrayToPolygonCoordinates(params.points);
    const featureName = this.name;

    // Get or create target item
    const targetItem = getOrCreateAnnotationItem(
      this.terria,
      this.addToExisting ? this.targetItemId : null,
      featureName
    );

    // Add to workbench and persist
    void this.terria.workbench.add(targetItem);
    void targetItem.loadMapItems();

    appendFeatureToGeoJsonItem(targetItem, polygonCoordinates, featureName);

    // Reset for next drawing
    runInAction(() => {
      this.targetItemId = targetItem.uniqueId ?? null;
      this.nameInput = "";
    });
  }

  /** Reset all state to initial values */
  @action.bound
  private resetState() {
    this.targetItemId = null;
    this.addToExisting = false;
    this.nameInput = "";
  }

  onCleanUp() {
    this.resetState();
    this.onClose();
    super.deactivate();
  }

  deactivate() {
    this.userDrawing.endDrawing();
    super.deactivate();
  }

  activate() {
    this.resetState();
    this.userDrawing.enterDrawMode();
    super.activate();
  }
}
