
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./Notifications.css";

const API = `${API_BASE_URL}/api`;

function Notifications() {
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const unreadCount = notifications.filter(
        (item) => !item.isRead
    ).length;

    const fetchNotifications = useCallback(async () => {
        try {
            const token = sessionStorage.getItem("token");

            const response = await axios.get(
                `${API}/notifications/my`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setNotifications(response.data.notifications || []);
            setError("");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load notifications."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();

        const token = sessionStorage.getItem("token");
        if (!token) return;

        const socket = io(API_BASE_URL, {
            auth: {
                token,
                role: "employee",
            },
        });

        // Refresh notifications when a new payroll notification arrives
        socket.on("payroll-notification", () => {
            fetchNotifications();
        });

        socket.on("connect_error", (err) => {
            console.error("Notification socket error:", err.message);
        });

        return () => {
            socket.off("payroll-notification");
            socket.disconnect();
        };
    }, [fetchNotifications]);

    const handleMarkRead = async (notificationId) => {
        try {
            const token = sessionStorage.getItem("token");

            await axios.patch(
                `${API}/notifications/${notificationId}/read`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setNotifications((previous) =>
                previous.map((item) =>
                    item._id === notificationId
                        ? { ...item, isRead: true }
                        : item
                )
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to update notification."
            );
        }
    };

    const handleOpenNotification = async (notification) => {
        if (!notification.isRead) {
            await handleMarkRead(notification._id);
        }

        if (notification.type === "payroll") {
            navigate("/my-payroll");
        }
    };

    return (
        <div className="notifications-page">
            <div className="notifications-card">
                <header className="notifications-header">
                    <div>
                        <p className="employee-tag">EMPLOYEE PORTAL</p>
                        <h1>Notifications</h1>
                        <p>Stay updated with your payroll and other activities.</p>
                    </div>

                    <div className="notification-count">
                        {unreadCount} Unread
                    </div>
                </header>

                {loading ? (
                    <p>Loading notifications...</p>
                ) : error ? (
                    <p className="notification-error">{error}</p>
                ) : notifications.length === 0 ? (
                    <div className="notification-empty">
                        <h3>No notifications yet</h3>
                        <p>You're all caught up!</p>
                    </div>
                ) : (
                    <div className="notification-list">
                        {notifications.map((item) => (
                            <article
                                key={item._id}
                                className={`notification-item ${
                                    item.isRead ? "read" : "unread"
                                }`}
                            >
                                <div className="notification-content">
                                    <div className="notification-title-row">
                                        <h3>{item.title}</h3>

                                        {!item.isRead && (
                                            <span className="unread-dot">
                                                New
                                            </span>
                                        )}
                                    </div>

                                    <p>{item.message}</p>

                                    <div className="notification-meta">
                                        <span>{item.type}</span>
                                        <span>
                                            {new Date(
                                                item.createdAt
                                            ).toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                </div>

                                <div className="notification-actions">
                                    {item.type === "payroll" && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleOpenNotification(item)
                                            }
                                        >
                                            View Payroll
                                        </button>
                                    )}

                                    {!item.isRead && (
                                        <button
                                            type="button"
                                            className="mark-read-btn"
                                            onClick={() =>
                                                handleMarkRead(item._id)
                                            }
                                        >
                                            Mark as Read
                                        </button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Notifications;
