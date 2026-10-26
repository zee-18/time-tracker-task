import type { KeyboardEvent } from "react";
import type { TreeRow as TreeRowData } from "./treeView";

interface TreeRowProps {
  row: TreeRowData;
  active: boolean;
  loading: boolean;
  onActivate: (row: TreeRowData) => void;
  onFocus: (key: string) => void;
  onKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    row: TreeRowData,
  ) => void;
  registerRef: (
    key: string,
    element: HTMLDivElement | null,
  ) => void;
}

function rowLabel(row: TreeRowData): string {
  if (row.kind === "all") {
    return "All my entries";
  }

  return row.kind === "client"
    ? row.client.name
    : row.kind === "project"
      ? row.project.name
      : row.task.name;
}

function expandedValue(row: TreeRowData): boolean | undefined {
  return row.kind === "client" || row.kind === "project"
    ? row.expanded
    : undefined;
}

export function TreeRow({
  row,
  active,
  loading,
  onActivate,
  onFocus,
  onKeyDown,
  registerRef,
}: TreeRowProps) {
  const label = rowLabel(row);
  const expanded = expandedValue(row);
  const hasChildren = row.kind === "client" || row.kind === "project";

  return (
    <div
      ref={(element) => registerRef(row.key, element)}
      role="treeitem"
      aria-level={row.level}
      aria-selected={row.selected}
      aria-expanded={expanded}
      data-tree-row={row.key}
      tabIndex={active ? 0 : -1}
      className={[
        "tree-row",
        row.selected ? "tree-row--selected" : "",
        row.kind === "task" ? "tree-row--task" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        paddingLeft: `${8 + (row.level - 1) * 16}px`,
      }}
      onClick={(event) => {
        event.currentTarget.focus();
        onActivate(row);
      }}
      onFocus={() => onFocus(row.key)}
      onKeyDown={(event) => onKeyDown(event, row)}
    >
      <span className="tree-chevron" aria-hidden="true">
        {hasChildren ? (row.expanded ? "▾" : "▸") : ""}
      </span>
      <span
        className={[
          "tree-label",
          row.kind === "all" ? "tree-label--all" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        title={label}
      >
        {label}
      </span>
      {row.kind === "task" ? (
        <span className="tree-badge">{row.task.status}</span>
      ) : null}
      {loading ? (
        <>
          <span className="tree-spinner" aria-hidden="true" />
          <span className="sr-only">Loading</span>
        </>
      ) : null}
    </div>
  );
}
