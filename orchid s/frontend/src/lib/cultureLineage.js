const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const readParentJarId = (entry) =>
  String(
    entry?.directParentJarId ||
      entry?.direct_parent_jar_id ||
      entry?.sourceJarId ||
      entry?.source_jar_id ||
      entry?.parentJarId ||
      entry?.parentJarID ||
      entry?.parent_jar_id ||
      entry?.parentJar ||
      entry?.parent_id ||
      ""
  ).trim();

export const buildCultureLineageTree = (entries, jarId) => {
  const byId = new Map();
  const childrenByParent = new Map();
  const parentById = new Map();

  (entries || []).forEach((entry) => {
    const id = String(entry?.jarId || entry?.jar_id || "").trim();
    if (!id) return;

    const idKey = normalizeKey(id);
    byId.set(idKey, entry);

    const parent = readParentJarId(entry);
    if (!parent) return;

    const parentKey = normalizeKey(parent);
    const list = childrenByParent.get(parentKey) || [];
    childrenByParent.set(parentKey, [...list, id]);
    parentById.set(idKey, parent);
  });

  const resolveRootId = (startId) => {
    const seen = new Set();
    let cursor = String(startId || "").trim();
    while (cursor) {
      const key = normalizeKey(cursor);
      if (!key || seen.has(key)) break;
      seen.add(key);
      const parent = parentById.get(key);
      if (!parent) break;
      cursor = parent;
    }
    return cursor || String(startId || "").trim();
  };

  const visited = new Set();
  const buildNode = (id) => {
    const key = normalizeKey(id);
    if (!key || visited.has(key)) return null;
    visited.add(key);

    const entry = byId.get(key) || { jarId: id };
    const children = (childrenByParent.get(key) || [])
      .map((childId) => buildNode(childId))
      .filter(Boolean);

    return {
      jarId: entry.jarId || id,
      parentJarId: readParentJarId(entry),
      children,
    };
  };

  return buildNode(resolveRootId(jarId));
};

export const formatCultureLineageAscii = (tree) => {
  if (!tree) return "";
  const lines = [];

  const walk = (node, prefix = "", isLast = true, isRoot = false) => {
    if (isRoot) {
      lines.push(node.jarId);
    } else {
      lines.push(`${prefix}${isLast ? "\u2514\u2500\u2500 " : "\u251C\u2500\u2500 "}${node.jarId}`);
    }

    const nextPrefix = isRoot ? "" : `${prefix}${isLast ? "    " : "\u2502   "}`;
    node.children.forEach((child, idx) => {
      walk(child, nextPrefix, idx === node.children.length - 1, false);
    });
  };

  walk(tree, "", true, true);
  return lines.join("\n");
};
