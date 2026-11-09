import type { Material } from "./schema.js";

export type SprintMaterialNode = Material & {
  isSelected: boolean;
  tagIds: string[];
  children: SprintMaterialNode[];
};

export type SprintMaterialCandidate = SprintMaterialNode & {
  isMatch: boolean;
  unmatchedDescendantCount: number;
  children: SprintMaterialCandidate[];
};

// Each inner list is one Tag group's chosen Tags: OR within a group, AND across groups.
export function filterSprintMaterialCandidates(
  materials: SprintMaterialNode[],
  tagFilter: ReadonlyArray<ReadonlyArray<string>>,
): SprintMaterialCandidate[] {
  const activeGroups = tagFilter.filter((tagIds) => tagIds.length > 0);
  const matches = (material: SprintMaterialNode) =>
    activeGroups.every((tagIds) =>
      tagIds.some((tagId) => material.tagIds.includes(tagId)),
    );
  const countUnmatched = (material: SprintMaterialNode): number =>
    material.children.reduce(
      (count, child) =>
        count + (matches(child) ? 0 : 1) + countUnmatched(child),
      0,
    );
  const filter = (nodes: SprintMaterialNode[]): SprintMaterialCandidate[] =>
    nodes.flatMap((material) => {
      const children = filter(material.children);
      const isMatch = matches(material);
      if (!isMatch && children.length === 0) return [];
      return [
        {
          ...material,
          isMatch,
          unmatchedDescendantCount: isMatch ? countUnmatched(material) : 0,
          children,
        },
      ];
    });
  return filter(materials);
}

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
