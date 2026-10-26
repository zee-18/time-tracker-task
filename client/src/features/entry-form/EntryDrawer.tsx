import { useQueryClient } from "@tanstack/react-query";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  entryKey,
  getKnownEntries,
} from "../../api/entriesQueries";
import {
  useCreateEntry,
  useDeleteEntry,
  useUpdateEntry,
} from "../../api/entriesMutations";
import type { Entry } from "../../api/types";
import { setHighlight } from "../../features/entries/highlightStore";
import {
  ENTRY_FIELD_ORDER,
  validateEntryForm,
  type EntryErrors,
  type EntryField,
} from "../../lib/entryValidation";
import { getWarnings } from "../../lib/entryWarnings";
import { formatDateTimeLocal } from "../../lib/dates";
import Toast from "../../components/Toast";
import {
  getSelection,
  getTaskPath,
  useTaskPathsRevision,
  type TaskPath,
} from "../tree/selection";
import {
  closeDrawer,
  restoreDrawerFocus,
  useDrawer,
  type OpenDrawerState,
} from "./drawerStore";
import EntryForm from "./EntryForm";
import {
  DeleteConfirm,
  DiscardConfirm,
} from "./EntryFormFeedback";
import {
  buildEntryInput,
  classifyDeleteError,
  classifySaveError,
  createEntryFormInitial,
  getApiErrorCode,
  savedEntryLabel,
} from "./entryFormModel";
import type { SaveErrorState } from "./EntryFormFeedback";

interface EntryDrawerProps {
  onCreated: (entry: Entry) => void;
  onReloadList: () => Promise<void>;
}

interface SavedToast {
  id: number;
  message: string;
}

export function EntryDrawer({
  onCreated,
  onReloadList,
}: EntryDrawerProps) {
  const drawer = useDrawer();
  const [toast, setToast] = useState<SavedToast | null>(null);
  const toastCounter = useRef(0);

  const handleSaved = (
    entry: Entry,
    saveKind: "create" | "update",
    taskPath: TaskPath | null,
    keepOpen: boolean,
  ): void => {
    setHighlight(entryKey(entry));

    if (saveKind === "create") {
      onCreated(entry);
    }

    const selection = getSelection();
    let message = `Entry #${entry.id} saved`;

    if (
      selection.view === "task" &&
      selection.task.id !== entry.taskId
    ) {
      message += ` — ${savedEntryLabel(entry, taskPath)}`;
    }

    toastCounter.current += 1;
    setToast({ id: toastCounter.current, message });

    if (!keepOpen) {
      closeDrawer();
    }
  };

  const handleDeleted = (entry: Entry): void => {
    toastCounter.current += 1;
    setToast({
      id: toastCounter.current,
      message: `Entry #${entry.id} deleted`,
    });
    closeDrawer();
  };

  return (
    <>
      {drawer.mode !== "closed" ? (
        <EntryDrawerSession
          key={
            drawer.mode === "edit"
              ? `edit-${drawer.entry.id}`
              : "create"
          }
          drawer={drawer}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onReloadList={onReloadList}
        />
      ) : null}

      {toast !== null ? (
        <Toast
          key={toast.id}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </>
  );
}

interface EntryDrawerSessionProps {
  drawer: OpenDrawerState;
  onSaved: (
    entry: Entry,
    saveKind: "create" | "update",
    taskPath: TaskPath | null,
    keepOpen: boolean,
  ) => void;
  onDeleted: (entry: Entry) => void;
  onReloadList: () => Promise<void>;
}

function EntryDrawerSession({
  drawer,
  onSaved,
  onDeleted,
  onReloadList,
}: EntryDrawerSessionProps) {
  const queryClient = useQueryClient();
  const createEntryMutation = useCreateEntry();
  const updateEntryMutation = useUpdateEntry();
  const deleteEntryMutation = useDeleteEntry();
  const knownEntries = useMemo(
    () => getKnownEntries(queryClient),
    [queryClient],
  );
  const [initial, setInitial] = useState(() =>
    createEntryFormInitial(drawer, knownEntries),
  );
  const [taskId, setTaskId] = useState(initial.taskId);
  const [taskPath, setTaskPath] = useState<TaskPath | null>(
    initial.taskPath,
  );
  const [comment, setComment] = useState(initial.comment);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [touched, setTouched] = useState<Set<EntryField>>(
    () => new Set(),
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveAction, setSaveAction] = useState<
    "save" | "save-another" | null
  >(null);
  const [reloading, setReloading] = useState(false);
  const [lockedByApi, setLockedByApi] = useState(false);
  const [saveError, setSaveError] = useState<SaveErrorState | null>(
    null,
  );
  const [saveErrorMode, setSaveErrorMode] = useState<"save" | "delete">(
    "save",
  );
  const [listNote, setListNote] = useState<string | null>(null);
  const [smartStartHint, setSmartStartHint] = useState(
    initial.smartStart,
  );
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const saveErrorRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const saveInFlightRef = useRef(false);
  const lastSaveKindRef = useRef<"create" | "update">(
    drawer.mode === "edit" ? "update" : "create",
  );
  useTaskPathsRevision();

  const editEntry = drawer.mode === "edit" ? drawer.entry : null;
  const locked =
    (editEntry !== null && editEntry.id === 0) || lockedByApi;
  const resolvedTaskPath =
    taskId === null
      ? null
      : taskPath !== null && taskPath.task.id === taskId
        ? taskPath
        : (getTaskPath(taskId) ?? null);
  const isDirty =
    taskId !== initial.taskId ||
    comment !== initial.comment ||
    start !== initial.start ||
    end !== initial.end;
  const warnings = useMemo(
    () =>
      getWarnings(
        { start, end },
        knownEntries,
        editEntry,
        new Date(),
      ),
    [editEntry, end, knownEntries, start],
  );
  const errors = validateEntryForm({
    taskId,
    comment,
    start,
    end,
  });
  const visibleErrors = useMemo(() => {
    const next: EntryErrors = {};

    for (const field of ENTRY_FIELD_ORDER) {
      const message = errors[field];

      if (
        message !== undefined &&
        (submitAttempted || touched.has(field))
      ) {
        next[field] = message;
      }
    }

    return next;
  }, [errors, submitAttempted, touched]);

  const title =
    editEntry === null
      ? "New entry"
      : `Edit entry #${editEntry.id}`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog === null) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }

      document.body.style.overflow = previousOverflow;
      restoreDrawerFocus();
    };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (locked) {
        closeButtonRef.current?.focus();
      } else {
        commentRef.current?.focus();
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [editEntry, locked]);

  const focusFirstError = (nextErrors: EntryErrors): void => {
    for (const field of ENTRY_FIELD_ORDER) {
      if (nextErrors[field] === undefined) {
        continue;
      }

      if (field === "taskId") {
        commentRef.current?.focus();
      } else if (field === "comment") {
        commentRef.current?.focus();
      } else if (field === "start") {
        startRef.current?.focus();
      } else {
        endRef.current?.focus();
      }

      return;
    }
  };

  const clearSaveError = (): void => {
    if (saveError !== null) {
      setSaveError(null);
      setSaveErrorMode("save");
    }
  };

  const markTouched = (field: EntryField): void => {
    setTouched((previous) => {
      if (previous.has(field)) {
        return previous;
      }

      const next = new Set(previous);
      next.add(field);
      return next;
    });
  };

  const requestClose = (): void => {
    if (saving) {
      return;
    }

    if (isDirty) {
      setDiscardOpen(true);
      return;
    }

    closeDrawer();
  };

  const keepEditing = (): void => {
    setDiscardOpen(false);
    requestAnimationFrame(() => {
      commentRef.current?.focus();
    });
  };

  const keepEntry = (): void => {
    setDeleteOpen(false);
    requestAnimationFrame(() => {
      commentRef.current?.focus();
    });
  };

  const discardChanges = (): void => {
    setDiscardOpen(false);
    closeDrawer();
  };

  const handleDeleteRequest = (): void => {
    if (editEntry === null || editEntry.id === 0 || saving || deleting) {
      return;
    }

    setSaveError(null);
    setSaveErrorMode("save");
    setDeleteOpen(true);
  };

  const handleRemoveFromList = (): void => {
    if (editEntry === null) {
      return;
    }

    setSaveError(null);
    setSaveErrorMode("save");
    void deleteEntryMutation.mutateAsync(editEntry).finally(() => {
      closeDrawer();
    });
  };

  const handleDeleteEntry = async (): Promise<void> => {
    if (editEntry === null || deleting || saving || reloading) {
      return;
    }

    setDeleteOpen(false);
    setSaveError(null);
    setSaveErrorMode("delete");
    setDeleting(true);

    try {
      await deleteEntryMutation.mutateAsync(editEntry);
      onDeleted(editEntry);
    } catch (error) {
      const nextError = classifyDeleteError(error);
      setSaveError(nextError);
      setSaveErrorMode("delete");

      if (nextError.kind === "entry-not-found") {
        requestAnimationFrame(() => {
          saveErrorRef.current?.focus();
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  const resetAfterCreate = (saved: Entry): void => {
    if (drawer.mode !== "create") {
      return;
    }

    const startDate = new Date(saved.end);
    const endDate = new Date();
    endDate.setSeconds(0, 0);

    if (endDate.getTime() <= startDate.getTime() + 60_000) {
      endDate.setTime(startDate.getTime() + 30 * 60_000);
    }

    const rootTaskPath = resolvedTaskPath ?? drawer.task;
    const nextInitial = createEntryFormInitial(
      {
        mode: "create",
        task: rootTaskPath,
      },
      knownEntries,
    );

    nextInitial.comment = "";
    nextInitial.start = formatDateTimeLocal(startDate);
    nextInitial.end = formatDateTimeLocal(endDate);
    nextInitial.smartStart = true;

    setInitial(nextInitial);
    setTaskId(nextInitial.taskId);
    setTaskPath(nextInitial.taskPath);
    setComment(nextInitial.comment);
    setStart(nextInitial.start);
    setEnd(nextInitial.end);
    setTouched(new Set());
    setSubmitAttempted(false);
    setSaveError(null);
    setListNote(null);
    setSmartStartHint(true);
    requestAnimationFrame(() => {
      commentRef.current?.focus();
    });
  };

  const save = async (
    saveKind: "create" | "update",
    options: { keepDrawerOpen?: boolean } = {},
  ): Promise<void> => {
    if (saveInFlightRef.current || locked) {
      return;
    }

    setSubmitAttempted(true);
    setSaveError(null);
    setSaveErrorMode("save");
    setListNote(null);
    setSaveAction(
      saveKind === "create" && options.keepDrawerOpen
        ? "save-another"
        : "save",
    );

    const nextErrors = validateEntryForm({
      taskId,
      comment,
      start,
      end,
    });

    if (Object.keys(nextErrors).length > 0) {
      focusFirstError(nextErrors);
      return;
    }

    const input = buildEntryInput({
      mode: drawer.mode,
      taskId,
      comment,
      start,
      end,
      initial,
    });

    if (input === null) {
      focusFirstError(nextErrors);
      return;
    }

    if (saveKind === "update" && editEntry === null) {
      return;
    }

    lastSaveKindRef.current = saveKind;
    saveInFlightRef.current = true;
    setSaving(true);

    try {
      let saved: Entry;

      if (saveKind === "create") {
        saved = await createEntryMutation.mutateAsync(input);
      } else {
        if (editEntry === null) {
          return;
        }

        saved = await updateEntryMutation.mutateAsync({
          id: editEntry.id,
          input,
        });
      }

      onSaved(
        saved,
        saveKind,
        resolvedTaskPath,
        options.keepDrawerOpen === true,
      );

      if (options.keepDrawerOpen === true) {
        resetAfterCreate(saved);
      }
    } catch (error) {
      const code = getApiErrorCode(error);

      if (code === "ENTRY_ID_LOCKED") {
        setLockedByApi(true);
        setSaveError(null);
        return;
      }

      const nextError = classifySaveError(error, saveKind);
      setSaveErrorMode("save");
      setSaveError(nextError);

      if (nextError.kind === "bad-request") {
        const localErrors = validateEntryForm({
          taskId,
          comment,
          start,
          end,
        });
        focusFirstError(localErrors);
      } else if (nextError.kind === "task-not-found") {
        requestAnimationFrame(() => {
          saveErrorRef.current?.focus();
        });
      }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
      setSaveAction(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void save(editEntry === null ? "create" : "update");
  };

  const reloadList = async (): Promise<void> => {
    if (reloading || saving) {
      return;
    }

    setReloading(true);
    setListNote("Reloading list...");

    try {
      await onReloadList();
      setListNote("List reloaded.");
    } catch {
      setListNote("Couldn't reload the list. Please try again.");
    } finally {
      setReloading(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="entry-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div className="entry-drawer-shell">
        <header className="entry-drawer-header">
          <h2 id="entry-drawer-title" className="entry-drawer-title">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="entry-drawer-close"
            aria-label="Close"
            disabled={saving}
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        {discardOpen ? (
          <DiscardConfirm
            onKeepEditing={keepEditing}
            onDiscard={discardChanges}
          />
        ) : null}

        {deleteOpen && editEntry !== null ? (
          <DeleteConfirm
            entryId={editEntry.id}
            onKeepEntry={keepEntry}
            onDeleteEntry={() => {
              void handleDeleteEntry();
            }}
          />
        ) : null}

        <EntryForm
          locked={locked}
          taskId={taskId}
          taskPath={resolvedTaskPath}
          comment={comment}
          start={start}
          end={end}
          errors={visibleErrors}
          warnings={warnings}
          smartStartHint={smartStartHint}
          saving={saving}
          saveAction={saveAction}
          reloading={reloading}
          saveError={saveError}
          saveErrorMode={saveErrorMode}
          listNote={listNote}
          isCreateMode={editEntry === null}
          commentRef={commentRef}
          saveErrorRef={saveErrorRef}
          startRef={startRef}
          endRef={endRef}
          onCommentChange={(value) => {
            setComment(value);
            clearSaveError();
          }}
          onStartChange={(value) => {
            setStart(value);
            setSmartStartHint(false);
            clearSaveError();
          }}
          onEndChange={(value) => {
            setEnd(value);
            clearSaveError();
          }}
          onCommentBlur={() => markTouched("comment")}
          onStartBlur={() => markTouched("start")}
          onEndBlur={() => markTouched("end")}
          onCancel={requestClose}
          onDelete={handleDeleteRequest}
          onRetry={() => {
            if (saveErrorMode === "delete") {
              void handleDeleteEntry();
              return;
            }

            void save(lastSaveKindRef.current);
          }}
          onSaveAsNew={() => {
            void save("create");
          }}
          onSaveAndAddAnother={() => {
            void save("create", { keepDrawerOpen: true });
          }}
          onReloadList={() => {
            void reloadList();
          }}
          onRemoveFromList={() => {
            handleRemoveFromList();
          }}
          onSubmit={handleSubmit}
        />
      </div>
    </dialog>
  );
}

export default EntryDrawer;
