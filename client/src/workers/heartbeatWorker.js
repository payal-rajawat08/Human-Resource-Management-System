let heartbeatInterval = null;
self.onmessage = (event) => {
    const { type } = event.data;
    if (type === "start") {
        // if koi heartbeat already chl rhi hai toh use stop krne ke liye 
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        // Har 30 seconds mein heartbeat message bhej ne ke liye 
        heartbeatInterval = setInterval(() => {
            // Worker main React thread ko message bhej raha hai
            self.postMessage({
                type: "heartbeat",
            });
        }, 30000);
    }
    if (type === "stop") {
        // Heartbeat timer stop kar ne liye 
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
        }
    }
};