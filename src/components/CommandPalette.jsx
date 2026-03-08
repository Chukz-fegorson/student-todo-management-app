import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import { ROLE_LABELS } from "../lib/constants";
import { createNavigationIntent } from "../lib/navigation";

function matchesText(value, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;
  return String(value || "").toLowerCase().includes(text);
}

function buildSearchText(parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export default function CommandPalette({ user, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [datasets, setDatasets] = useState({
    tasks: [],
    courses: [],
    meetings: [],
    products: [],
    invoices: [],
  });

  useEffect(() => {
    function handleKeydown(event) {
      const isShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isShortcut) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const requests = [
          user.role !== "parent" ? apiGet("/tasks").catch(() => []) : Promise.resolve([]),
          apiGet("/courses").catch(() => []),
          apiGet("/meetings").catch(() => []),
          apiGet("/market/products").catch(() => []),
          user.role !== "parent" ? apiGet("/fees/invoices").catch(() => []) : Promise.resolve([]),
        ];
        const [tasks, courses, meetings, products, invoices] = await Promise.all(requests);
        if (!active) return;
        setDatasets({
          tasks: Array.isArray(tasks) ? tasks : [],
          courses: Array.isArray(courses) ? courses : [],
          meetings: Array.isArray(meetings) ? meetings : [],
          products: Array.isArray(products) ? products : [],
          invoices: Array.isArray(invoices) ? invoices : [],
        });
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to load quick search data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [open, user.role]);

  const actions = useMemo(() => {
    const common = [
      {
        id: "open-courses",
        label: "Open Courses",
        meta: "Jump to course workspace",
        route: createNavigationIntent({ module: "courses" }),
      },
      {
        id: "open-collab",
        label: "Open Collab Hub",
        meta: "Meetings, chat, and community feed",
        route: createNavigationIntent({ module: "collab", tab: "chat" }),
      },
      {
        id: "open-market",
        label: "Open Marketplace",
        meta: "Browse listings and orders",
        route: createNavigationIntent({ module: "market", meta: { view: "browse" } }),
      },
    ];

    if (user.role === "student") {
      return [
        {
          id: "new-task",
          label: "Create New Task",
          meta: "Open task composer",
          route: createNavigationIntent({ module: "tasks", action: "new_task" }),
        },
        {
          id: "open-fees",
          label: "Open My Fees",
          meta: "Invoices and payment records",
          route: createNavigationIntent({ module: "fees" }),
        },
        ...common,
      ];
    }

    if (user.role === "parent") {
      return [
        {
          id: "link-child",
          label: "Link Child Account",
          meta: "Open parent workspace and link form",
          route: createNavigationIntent({ action: "focus_link_child" }),
        },
        ...common.filter((entry) => entry.id !== "open-market"),
      ];
    }

    return [
      {
        id: "assign-task",
        label: "Assign Tasks",
        meta: "Jump to task assignment",
        route: createNavigationIntent({ module: "tasks", action: "assign_task" }),
      },
      {
        id: "open-fees",
        label: "Open Fees Workspace",
        meta: "Plans, invoices, confirmations",
        route: createNavigationIntent({ module: "fees" }),
      },
      ...common,
    ];
  }, [user.role]);

  const actionResults = useMemo(
    () =>
      actions.filter((entry) =>
        matchesText(buildSearchText([entry.label, entry.meta]), query)
      ),
    [actions, query]
  );

  const taskResults = useMemo(
    () =>
      datasets.tasks
        .filter((entry) =>
          matchesText(
            buildSearchText([entry.title, entry.description, entry.status, entry.category]),
            query
          )
        )
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          label: entry.title,
          meta: `${entry.status} | ${entry.category || "Task"}`,
          route: createNavigationIntent({
            module: "tasks",
            entityType: "task",
            entityId: entry.id,
          }),
        })),
    [datasets.tasks, query]
  );

  const courseResults = useMemo(
    () =>
      datasets.courses
        .filter((entry) =>
          matchesText(
            buildSearchText([entry.title, entry.description, entry.ownerRole]),
            query
          )
        )
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          label: entry.title,
          meta: `${ROLE_LABELS[entry.ownerRole] || entry.ownerRole || "Course"} | ${Number(entry.creditUnits || 0)} units`,
          route: createNavigationIntent({
            module: "courses",
            entityType: "course",
            entityId: entry.id,
          }),
        })),
    [datasets.courses, query]
  );

  const meetingResults = useMemo(
    () =>
      datasets.meetings
        .filter((entry) =>
          matchesText(
            buildSearchText([entry.title, entry.description, entry.hostName]),
            query
          )
        )
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          label: entry.title,
          meta: `${entry.hostName || "Host"} | ${entry.scheduledFor || "Meeting"}`,
          route: createNavigationIntent({
            module: "collab",
            tab: "meetings",
            entityType: "meeting",
            entityId: entry.id,
          }),
        })),
    [datasets.meetings, query]
  );

  const productResults = useMemo(
    () =>
      datasets.products
        .filter((entry) =>
          matchesText(
            buildSearchText([entry.title, entry.description, entry.sellerName, entry.schoolName]),
            query
          )
        )
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          label: entry.title,
          meta: `${entry.sellerName || "Seller"} | ${entry.schoolName || entry.stateName || "Marketplace"}`,
          route: createNavigationIntent({
            module: "market",
            entityType: "market_product",
            entityId: entry.id,
            meta: { view: "browse" },
          }),
        })),
    [datasets.products, query]
  );

  const invoiceResults = useMemo(
    () =>
      datasets.invoices
        .filter((entry) =>
          matchesText(
            buildSearchText([entry.title, entry.studentName, entry.schoolName, entry.status]),
            query
          )
        )
        .slice(0, 8)
        .map((entry) => ({
          id: entry.id,
          label: entry.title,
          meta: `${entry.status} | ${entry.studentName || entry.schoolName || "Invoice"}`,
          route: createNavigationIntent({
            module: "fees",
            entityType: "invoice",
            entityId: entry.id,
          }),
        })),
    [datasets.invoices, query]
  );

  const sections = [
    { id: "actions", title: "Quick Actions", rows: actionResults },
    { id: "tasks", title: "Tasks", rows: taskResults },
    { id: "courses", title: "Courses", rows: courseResults },
    { id: "meetings", title: "Meetings", rows: meetingResults },
    { id: "products", title: "Marketplace", rows: productResults },
    { id: "invoices", title: "Invoices", rows: invoiceResults },
  ].filter((section) => section.rows.length);
  const flatResults = useMemo(
    () =>
      sections.flatMap((section) =>
        section.rows.map((row) => ({
          key: `${section.id}-${row.id}`,
          ...row,
        }))
      ),
    [sections]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!flatResults.length) {
      setSelectedIndex(0);
      return;
    }
    if (selectedIndex > flatResults.length - 1) {
      setSelectedIndex(0);
    }
  }, [flatResults, selectedIndex]);

  function handleSelect(route) {
    if (onNavigate) onNavigate(route);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="command-launcher">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen(true)}
      >
        Quick Search
        <span className="command-shortcut">Ctrl K</span>
      </button>

      {open && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="modal command-palette">
            <div className="command-head">
              <div>
                <div className="modal-title">Quick Search and Actions</div>
                <div className="panel-copy">
                  Search tasks, courses, meetings, invoices, and products from one place.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="field">
              <label>Search</label>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (!flatResults.length) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % flatResults.length);
                  }
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedIndex((prev) =>
                      prev === 0 ? flatResults.length - 1 : prev - 1
                    );
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSelect(flatResults[selectedIndex].route);
                  }
                }}
                placeholder="Type a task, course, meeting, product, or action..."
              />
            </div>

            {error && <div className="error-msg">{error}</div>}
            {loading && <div className="empty-col">Loading search data...</div>}
            {!loading && !sections.length && (
              <div className="empty-col">No results match your search.</div>
            )}

            {!loading && sections.length > 0 && (
              <div className="command-results">
                {sections.map((section) => (
                  <section key={section.id} className="command-section">
                    <div className="panel-kicker">{section.title}</div>
                    <div className="command-result-list">
                      {section.rows.map((row) => {
                        const resultKey = `${section.id}-${row.id}`;
                        const isActive =
                          flatResults[selectedIndex]?.key === resultKey;
                        return (
                        <button
                          key={resultKey}
                          type="button"
                          className={`command-result-item ${
                            isActive ? "active" : ""
                          }`}
                          onClick={() => handleSelect(row.route)}
                          onMouseEnter={() => {
                            const hoverIndex = flatResults.findIndex(
                              (entry) => entry.key === resultKey
                            );
                            if (hoverIndex >= 0) setSelectedIndex(hoverIndex);
                          }}
                        >
                          <strong>{row.label}</strong>
                          <small>{row.meta}</small>
                        </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
