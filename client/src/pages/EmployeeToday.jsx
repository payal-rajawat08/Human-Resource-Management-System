import { useRef, useState } from "react";
import axios from "axios";

const EmployeeToday = () => {
    const screenStreamRef = useRef(null);
    const [shareActive, setShareActive] = useState(false);
    const handleStartWork = async () => {
        // Browser se screen share mangne ke liye
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                // Entire screen ko request karne ke liye
                displaySurface: "monitor",
            },
            audio: false,
        });
        const videoTrack = stream.getVideoTracks()[0];
        videoTrack.onended = () => {
        setShareActive(false);
     };
        // User ne actual me kya share kiya
        const displaySurface =
            videoTrack.getSettings().displaySurface;
        if (displaySurface !== "monitor") {
            alert("Please select Entire Screen");
            // Wrong screen tab sharing ko stop karo
            stream.getTracks().forEach((track) => track.stop());
            // Picker dobara kholo
            return handleStartWork();
        }
        screenStreamRef.current = stream;
        setShareActive(true);
        const token = localStorage.getItem("token");
        const response = await axios.post(
            "http://localhost:8000/api/sessions/start",
            {
                shareActive: true,
                displaySurface,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        console.log(response.data);
    };

    return (
        <button onClick={handleStartWork}>
            Start Work
        </button>
    );
};

export default EmployeeToday;