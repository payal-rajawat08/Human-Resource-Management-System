
import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import "./SuperAdminDashboard.css";

const API = `${API_BASE_URL}/api/admin`;

const AVAILABLE_PERMISSIONS = [
    { value: "employees.view", label: "View Employees" },
    { value: "employees.create", label: "Create Employees" },
    { value: "employees.edit", label: "Edit Employees" },
    { value: "employee.edit", label: "Delete Employees" },
    { value: "attendance.view", label: "View Attendance" },
    { value: "leaves.manage", label: "Manage Leaves" },
];

function SuperAdminDashboard() {
    const navigate = useNavigate();

    const [totalEmployees, setTotalEmployees] = useState(0);
    const [presentToday, setPresentToday] = useState(0);
    const [pendingLeaves, setPendingLeaves] = useState(0);

    const [admins, setAdmins] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [creatingAdmin, setCreatingAdmin] = useState(false);

    const [notice, setNotice] = useState("");
    const [noticeType, setNoticeType] = useState("success");

    const [editingAdmin, setEditingAdmin] = useState(null);
    const [editedPermissions, setEditedPermissions] = useState([]);
    const [savingPermissions, setSavingPermissions] = useState(false);

    const [adminForm, setAdminForm] = useState({
        name: "",
        email: "",
        password: "",
        permissions: ["employees.view"],
    });

    const getHeaders = useCallback(
        () => ({
            Authorization: `Bearer ${sessionStorage.getItem("adminToken")}`,
        }),
        []
    );

    const showNotice = useCallback((message, type = "success") => {
        setNotice(message);
        setNoticeType(type);
    }, []);

    // Load Admin accounts
    const loadAdmins = useCallback(async () => {
        setLoadingAdmins(true);

        try {
            const response = await axios.get(`${API}/admins`, {
                headers: getHeaders(),
            });

            setAdmins(response.data.admins || []);
        } catch (error) {
            showNotice(
                error.response?.data?.message ||
                    "Could not load Admin accounts.",
                "error"
            );
        } finally {
            setLoadingAdmins(false);
        }
    }, [getHeaders, showNotice]);

    // Check Super Admin login and load dashboard
    useEffect(() => {
        const token = sessionStorage.getItem("adminToken");
        const role = sessionStorage
            .getItem("userRole")
            ?.toLowerCase()
            .replace(/[\s_-]/g, "");

        if (!token || role !== "superadmin") {
            navigate("/login", { replace: true });
            return;
        }

        const loadDashboard = async () => {
            try {
                const [employees, attendance, leaves] = await Promise.all([
                    axios.get(`${API}/employees`, {
                        headers: getHeaders(),
                    }),
                    axios.get(`${API}/attendance/today`, {
                        headers: getHeaders(),
                    }),
                    axios.get(`${API}/leaves`, {
                        headers: getHeaders(),
                    }),
                ]);

                setTotalEmployees(
                    employees.data.employees?.length || 0
                );

                setPresentToday(
                    attendance.data.presentToday || 0
                );

                setPendingLeaves(
                    leaves.data.leaves?.filter(
                        (leave) => leave.status === "Pending"
                    ).length || 0
                );
            } catch (error) {
                console.error(
                    "Super Admin dashboard error:",
                    error.response?.data || error.message
                );
            }
        };

        loadDashboard();
        loadAdmins();
    }, [navigate, getHeaders, loadAdmins]);

    // Toggle permissions while creating an Admin
    const togglePermission = (permission) => {
        setAdminForm((previous) => ({
            ...previous,
            permissions: previous.permissions.includes(permission)
                ? previous.permissions.filter(
                      (item) => item !== permission
                  )
                : [...previous.permissions, permission],
        }));
    };

    // Create Admin
    const handleCreateAdmin = async (event) => {
        event.preventDefault();
        setNotice("");

        if (
            !adminForm.name.trim() ||
            !adminForm.email.trim() ||
            !adminForm.password
        ) {
            showNotice("Please fill in all fields.", "error");
            return;
        }

        if (adminForm.password.length < 8) {
            showNotice(
                "Password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        setCreatingAdmin(true);

        try {
            const response = await axios.post(
                `${API}/admins`,
                {
                    name: adminForm.name.trim(),
                    email: adminForm.email.trim().toLowerCase(),
                    password: adminForm.password,
                    permissions: adminForm.permissions,
                },
                {
                    headers: getHeaders(),
                }
            );

            showNotice(
                response.data.message || "Admin created successfully."
            );

            setAdminForm({
                name: "",
                email: "",
                password: "",
                permissions: ["employees.view"],
            });

            await loadAdmins();
        } catch (error) {
            showNotice(
                error.response?.data?.message ||
                    "Failed to create Admin.",
                "error"
            );
        } finally {
            setCreatingAdmin(false);
        }
    };

    // Delete Admin
    const handleDeleteAdmin = async (admin) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete Admin "${admin.name}" (${admin.email})?`
        );

        if (!confirmed) return;

        setNotice("");

        try {
            const response = await axios.delete(
                `${API}/admins/${admin._id}`,
                {
                    headers: getHeaders(),
                }
            );

            setAdmins((previous) =>
                previous.filter(
                    (item) => String(item._id) !== String(admin._id)
                )
            );

            if (
                String(editingAdmin?._id) === String(admin._id)
            ) {
                setEditingAdmin(null);
            }

            showNotice(
                response.data.message || "Admin deleted successfully."
            );
        } catch (error) {
            showNotice(
                error.response?.data?.message ||
                    "Failed to delete Admin.",
                "error"
            );
        }
    };

    // Open the Edit Permissions popup
    const handleEditPermissions = (admin) => {
        setEditingAdmin(admin);

        setEditedPermissions(
            Array.isArray(admin.permissions)
                ? [...admin.permissions]
                : []
        );

        setNotice("");
    };

    // Toggle permissions for an existing Admin
    const toggleEditedPermission = (permission) => {
        setEditedPermissions((previous) =>
            previous.includes(permission)
                ? previous.filter((item) => item !== permission)
                : [...previous, permission]
        );
    };

    // Save updated permissions
    const handleSavePermissions = async () => {
        if (!editingAdmin || savingPermissions) return;

        setSavingPermissions(true);
        setNotice("");

        try {
            const response = await axios.put(
                `${API}/admins/${editingAdmin._id}/permissions`,
                {
                    permissions: editedPermissions,
                },
                {
                    headers: getHeaders(),
                }
            );

            const updatedPermissions =
                response.data.permissions || editedPermissions;

            setAdmins((previous) =>
                previous.map((admin) =>
                    String(admin._id) === String(editingAdmin._id)
                        ? {
                              ...admin,
                              permissions: updatedPermissions,
                          }
                        : admin
                )
            );

            setEditingAdmin(null);

            showNotice(
                response.data.message ||
                    "Admin permissions updated successfully."
            );
        } catch (error) {
            showNotice(
                error.response?.data?.message ||
                    "Failed to update permissions.",
                "error"
            );
        } finally {
            setSavingPermissions(false);
        }
    };

    // Close popup
    const handleCancelEdit = () => {
        if (savingPermissions) return;

        setEditingAdmin(null);
        setEditedPermissions([]);
    };

    // Logout: clear this tab's session only
    const handleLogout = () => {
        [
            "token",
            "adminToken",
            "employeeId",
            "employeeName",
            "adminName",
            "userRole",
            "userPermissions",
        ].forEach((key) => sessionStorage.removeItem(key));

        navigate("/login", { replace: true });
    };

    // Prevent non-Super-Admin sessions from using this panel
    const currentRole = sessionStorage
        .getItem("userRole")
        ?.toLowerCase()
        .replace(/[\s_-]/g, "");

    const currentToken = sessionStorage.getItem("adminToken");

    if (!currentToken || currentRole !== "superadmin") {
        return null;
    }

    return (
        <div className="superadmin-dashboard">
            <aside className="superadmin-sidebar">
                <h2>HRMS</h2>

                <nav>
                    <p className="active">👑 Super Admin</p>
                    <Link to="/employees">👥 Employees</Link>
                    <Link to="/attendance">🕒 Attendance</Link>
                    <Link to="/leaves">📅 Leaves</Link>
                </nav>
            </aside>

            <main className="superadmin-main">
                <header className="superadmin-navbar">
                    <div>
                        <h3>Super Admin Panel</h3>
                        <span>Company-wide management</span>
                    </div>

                    <div className="superadmin-profile">
                        <span>
                            {sessionStorage.getItem("adminName") ||
                                "Super Admin"}
                        </span>

                        <button
                            type="button"
                            onClick={handleLogout}
                        >
                            Logout
                        </button>
                    </div>
                </header>

                <section className="superadmin-content">
                    <h1>Super Admin Dashboard</h1>
                    <p>Manage employees and Admin accounts.</p>

                    {notice && (
                        <div
                            className={`superadmin-alert ${
                                noticeType === "error"
                                    ? "superadmin-alert-error"
                                    : "superadmin-alert-success"
                            }`}
                            role="alert"
                        >
                            {notice}
                        </div>
                    )}

                    {/* Dashboard cards */}
                    <div className="superadmin-cards">
                        <button
                            className="superadmin-card"
                            type="button"
                            onClick={() => navigate("/employees")}
                        >
                            <h3>Total Employees</h3>
                            <p>{totalEmployees}</p>
                            <span>View employees →</span>
                        </button>

                        <button
                            className="superadmin-card"
                            type="button"
                            onClick={() => navigate("/attendance")}
                        >
                            <h3>Present Today</h3>
                            <p>{presentToday}</p>
                            <span>View attendance →</span>
                        </button>

                        <button
                            className="superadmin-card"
                            type="button"
                            onClick={() => navigate("/leaves")}
                        >
                            <h3>Pending Leaves</h3>
                            <p>{pendingLeaves}</p>
                            <span>Review requests →</span>
                        </button>
                    </div>

                    {/* Create Admin */}
                    <section className="superadmin-section">
                        <h2>Create Admin Account</h2>
                        <p>
                            Create a new Admin and assign individual
                            permissions.
                        </p>

                        <form
                            className="superadmin-form"
                            onSubmit={handleCreateAdmin}
                        >
                            <label>
                                Admin Name
                                <input
                                    className="superadmin-input"
                                    type="text"
                                    placeholder="Enter Admin name"
                                    value={adminForm.name}
                                    onChange={(event) =>
                                        setAdminForm((previous) => ({
                                            ...previous,
                                            name: event.target.value,
                                        }))
                                    }
                                    autoComplete="name"
                                    required
                                />
                            </label>

                            <label>
                                Email
                                <input
                                    className="superadmin-input"
                                    type="email"
                                    placeholder="Enter Admin email"
                                    value={adminForm.email}
                                    onChange={(event) =>
                                        setAdminForm((previous) => ({
                                            ...previous,
                                            email: event.target.value,
                                        }))
                                    }
                                    autoComplete="email"
                                    required
                                />
                            </label>

                            <label>
                                Temporary Password
                                <input
                                    className="superadmin-input"
                                    type="password"
                                    placeholder="Minimum 8 characters"
                                    value={adminForm.password}
                                    onChange={(event) =>
                                        setAdminForm((previous) => ({
                                            ...previous,
                                            password: event.target.value,
                                        }))
                                    }
                                    minLength={8}
                                    autoComplete="new-password"
                                    required
                                />
                            </label>

                            <div className="superadmin-permissions">
                                <h3>Assign Permissions</h3>

                                <div className="superadmin-permissions-grid">
                                    {AVAILABLE_PERMISSIONS.map(
                                        (permission) => (
                                            <label key={permission.value}>
                                                <input
                                                    type="checkbox"
                                                    checked={adminForm.permissions.includes(
                                                        permission.value
                                                    )}
                                                    onChange={() =>
                                                        togglePermission(
                                                            permission.value
                                                        )
                                                    }
                                                />

                                                <span>
                                                    {permission.label}
                                                </span>
                                            </label>
                                        )
                                    )}
                                </div>
                            </div>

                            <button
                                className="superadmin-submit-btn"
                                type="submit"
                                disabled={creatingAdmin}
                            >
                                {creatingAdmin
                                    ? "Creating..."
                                    : "Create Admin"}
                            </button>
                        </form>
                    </section>

                    {/* Manage Admins */}
                    <section className="superadmin-section">
                        <h2>Manage Admin Accounts</h2>

                        <p>
                            View Admin accounts, edit permissions, or delete
                            accounts.
                        </p>

                        <button
                            className="superadmin-refresh-btn"
                            type="button"
                            onClick={loadAdmins}
                            disabled={loadingAdmins}
                        >
                            {loadingAdmins
                                ? "Loading..."
                                : "Refresh List"}
                        </button>

                        {loadingAdmins ? (
                            <p>Loading Admin accounts...</p>
                        ) : admins.length === 0 ? (
                            <p>No Admin accounts found.</p>
                        ) : (
                            <div className="superadmin-admin-list">
                                {admins.map((admin) => (
                                    <article
                                        className="superadmin-admin-item"
                                        key={admin._id}
                                    >
                                        <div className="superadmin-admin-info">
                                            <h3>{admin.name}</h3>
                                            <p>{admin.email}</p>

                                            <strong>Permissions</strong>

                                            <p className="superadmin-permission-text">
                                                {admin.permissions?.length
                                                    ? admin.permissions.join(
                                                          ", "
                                                      )
                                                    : "No permissions assigned"}
                                            </p>

                                            <span
                                                className={`superadmin-status ${
                                                    admin.isActive
                                                        ? "is-active"
                                                        : "is-inactive"
                                                }`}
                                            >
                                                {admin.isActive
                                                    ? "Active"
                                                    : "Inactive"}
                                            </span>
                                        </div>

                                        <div className="superadmin-admin-actions">
                                            <button
                                                className="superadmin-edit-btn"
                                                type="button"
                                                onClick={() =>
                                                    handleEditPermissions(admin)
                                                }
                                            >
                                                Edit Permissions
                                            </button>

                                            <button
                                                className="superadmin-delete-btn"
                                                type="button"
                                                onClick={() =>
                                                    handleDeleteAdmin(admin)
                                                }
                                            >
                                                Delete Admin
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </section>
            </main>

            {/* Edit Permissions popup */}
            {editingAdmin && (
                <div
                    className="superadmin-modal-overlay"
                    onClick={handleCancelEdit}
                >
                    <div
                        className="superadmin-permission-editor"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="edit-permissions-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="superadmin-modal-header">
                            <div>
                                <h3 id="edit-permissions-title">
                                    Edit Permissions
                                </h3>

                                <p>
                                    Admin:{" "}
                                    <strong>{editingAdmin.name}</strong>
                                </p>
                            </div>

                            <button
                                type="button"
                                className="superadmin-modal-close"
                                onClick={handleCancelEdit}
                                disabled={savingPermissions}
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <div className="superadmin-permissions-grid">
                            {AVAILABLE_PERMISSIONS.map((permission) => (
                                <label key={permission.value}>
                                    <input
                                        type="checkbox"
                                        checked={editedPermissions.includes(
                                            permission.value
                                        )}
                                        onChange={() =>
                                            toggleEditedPermission(
                                                permission.value
                                            )
                                        }
                                    />

                                    <span>{permission.label}</span>
                                </label>
                            ))}
                        </div>

                        <div className="superadmin-editor-actions">
                            <button
                                className="superadmin-refresh-btn"
                                type="button"
                                onClick={handleCancelEdit}
                                disabled={savingPermissions}
                            >
                                Cancel
                            </button>

                            <button
                                className="superadmin-submit-btn"
                                type="button"
                                onClick={handleSavePermissions}
                                disabled={savingPermissions}
                            >
                                {savingPermissions
                                    ? "Saving..."
                                    : "Save Permissions"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SuperAdminDashboard;
