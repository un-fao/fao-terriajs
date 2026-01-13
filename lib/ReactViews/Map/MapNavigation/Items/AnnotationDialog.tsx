import { observer } from "mobx-react";
import React, { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import GeoJsonCatalogItem from "../../../../Models/Catalog/CatalogItems/GeoJsonCatalogItem";
import Box from "../../../../Styled/Box";
import Input from "../../../../Styled/Input";
import Checkbox from "../../../../Styled/Checkbox/Checkbox";
import Select from "../../../../Styled/Select";
import { GLYPHS, StyledIcon } from "../../../../Styled/Icon";
import Text from "../../../../Styled/Text";
import Spacing from "../../../../Styled/Spacing";

interface AnnotationDialogProps {
  availableItems: GeoJsonCatalogItem[];
  targetItemId: string | null;
  addToExisting: boolean;
  nameInput: string;
  placeholder: string;
  onTargetChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onAddToExistingChange: (checked: boolean) => void;
}

export const AnnotationDialog = observer(
  ({
    availableItems,
    targetItemId,
    addToExisting,
    nameInput,
    placeholder,
    onTargetChange,
    onNameChange,
    onAddToExistingChange
  }: AnnotationDialogProps) => {
    const { t } = useTranslation();
    const hasExistingAreas = availableItems.length > 0;

    return (
      <Box column paddedRatio={1}>
        <Box column>
          <Text as="label" htmlFor="annotation-name" bold textDarker>
            {t("annotation.nameLabel")}
          </Text>
          <Spacing bottom={1} />
          <Input
            id="annotation-name"
            type="text"
            value={nameInput}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={placeholder}
          />
        </Box>

        <Spacing bottom={1} />

        <Box fullWidth verticalCenter gap={1.2}>
          <Checkbox
            isChecked={addToExisting}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onAddToExistingChange(e.target.checked)
            }
            title={t("annotation.addToExistingTooltip")}
          >
            {t("annotation.addToExistingLabel")}
          </Checkbox>
          <span title={t("annotation.addToExistingTooltip")}>
            <StyledIcon
              glyph={GLYPHS.info}
              styledWidth="14px"
              styledHeight="14px"
              style={{ opacity: 0.7 }}
            />
          </span>
        </Box>

        {addToExisting && (
          <Box column>
            <Spacing bottom={1} />
            <Text as="label" htmlFor="annotation-group" bold textDarker>
              {t("annotation.existingAreaLabel")}
            </Text>
            <Spacing bottom={0.5} />
            <Select
              id="annotation-group"
              value={targetItemId ?? ""}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onTargetChange(e.target.value)
              }
              disabled={!hasExistingAreas}
            >
              <option value="">
                {hasExistingAreas
                  ? t("annotation.selectExistingPlaceholder")
                  : t("annotation.noExistingAreas")}
              </option>
              {availableItems.map((item) => {
                const itemId = item.uniqueId || "";
                const label = item.name || t("annotation.unnamedArea");
                return (
                  <option key={itemId} value={itemId}>
                    {label}
                  </option>
                );
              })}
            </Select>
            <Spacing bottom={0.5} />
            <Text small textDarker as="div">
              {hasExistingAreas
                ? t("annotation.existingAreaHelp")
                : t("annotation.createAreaFirst")}
            </Text>
          </Box>
        )}
      </Box>
    );
  }
);
