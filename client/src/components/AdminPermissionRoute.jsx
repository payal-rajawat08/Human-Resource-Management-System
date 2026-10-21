
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

function AdminPermissionRoute({ permission, children }) {
    const [allowed, setAllowed] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const checkPermission = async () => {
            const token = sessionStorage.getItem("adminToken");

            const currentRole = (
                sessionStorage.getItem("userRole") || ""
            )
                .toLowerCase()
                .replace(/[\s_-]/g, "");

            if (
                !token ||
                !["admin", "superadmin"].includes(currentRole)
            ) {
                if (!cancelled) {
                    setAllowed(false);
                }
                return;
            }

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/admin/me`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.admin) {
                    if (!cancelled) {
                        setAllowed(false);
                    }
                    return;
                }

                const role = String(data.admin.role || "")
                    .toLowerCase()
                    .replace(/[\s_-]/g, "");

                const isSuperAdmin = role === "superadmin";

                const permissions = Array.isArray(
                    data.admin.permissions
                )
                    ? data.admin.permissions
                    : [];

                const hasPermission = permissions.includes(permission);

                if (!cancelled) {
                    setAllowed(isSuperAdmin || hasPermission);
                }
            } catch (error) {
                console.error("Permission check failed:", error);

                if (!cancelled) {
                    setAllowed(false);
                }
            }
        };

        checkPermission();

        return () => {
            cancelled = true;
        };
    }, [permission]);

    if (allowed === null) {
        return <p>Checking permissions...</p>;
    }

    if (!allowed) {
        return <Navigate to="/login" replace />;
    }

    return children;
}

export default AdminPermissionRoute;
