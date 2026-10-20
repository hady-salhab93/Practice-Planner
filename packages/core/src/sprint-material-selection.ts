import type { Material } from "./schema.js";

export type SprintMaterialNode = Material & {
  isSelected: boolean;
  children: SprintMaterialNode[];
};

export function selectSprintMaterialTree(
  materials: SprintMaterialNode[],
  selectedIds: ReadonlySet<string>,
): SprintMaterialNode[] {
  return materials.flatMap((material) => {
    const children = selectSprintMaterialTree(material.children, selectedIds);
    return selectedIds.has(material.id)
      ? [{ ...material, isSelected: true, children }]
      : children;
  });
}
