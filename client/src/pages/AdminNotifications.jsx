import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/api";
import "./AdminNotifications.css";

const AdminNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const token = sessionStorage.getItem("adminToken");

        if (!token) return;

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        const fetchNotifications = async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/admin/notifications/my`,
                    { headers }
                );

                setNotifications(response.data.notifications || []);
                setUnreadCount(response.data.unreadCount || 0);
            } catch (error) {
                console.error(
                    "Failed to fetch admin notifications:",
                    error
                );
            }
        };

        fetchNotifications();

        const socket = io(API_BASE_URL, {
            auth: {
                token,
                role: "admin",
            },
        });

        socket.on("admin-payroll-notification", () => {
            fetchNotifications();
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const handleNotificationClick = async (notification) => {
        if (notification.isRead) return;

        const token = sessionStorage.getItem("adminToken");

        try {
            await axios.patch(
                `${API_BASE_URL}/api/admin/notifications/${notification._id}/read`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setNotifications((previous) =>
                previous.map((item) =>
                    item._id === notification._id
                        ? { ...item, isRead: true }
                        : item
                )
            );

            setUnreadCount((previous) => Math.max(0, previous - 1));
        } catch (error) {
            console.error(
                "Failed to mark notification as read:",
                error
            );
        }
    };

    return (
        <div className="admin-notifications-page">
            <div className="admin-notifications-page-header">
                <div>
                    <h2>Notifications</h2>
                    <p>
                        Stay updated on employee payroll disputes.
                    </p>
                </div>

                <span className="admin-notifications-unread">
                    {unreadCount} Unread
                </span>
            </div>

            {notifications.length === 0 ? (
                <div className="admin-notifications-empty">
                    <h3>No notifications yet</h3>
                    <p>
                        New payroll dispute notifications will appear here.
                    </p>
                </div>
            ) : (
                <div className="admin-notifications-page-list">
                    {notifications.map((notification) => (
                        <button
                            key={notification._id}
                            className={`admin-notifications-page-item ${
                                !notification.isRead ? "unread" : ""
                            }`}
                            onClick={() =>
                                handleNotificationClick(notification)
                            }
                        >
                            <div className="admin-notifications-page-item-top">
                                <strong>{notification.title}</strong>

                                {!notification.isRead && (
                                    <span className="unread-dot" />
                                )}
                            </div>

                            <p>{notification.message}</p>

                            <small>
                                {new Date(
                                    notification.createdAt
                                ).toLocaleString()}
                            </small>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminNotifications;
