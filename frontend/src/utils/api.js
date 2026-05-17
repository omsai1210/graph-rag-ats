export const api_base = import.meta.env.VITE_API_BASE || "https://graph-rag-ats.up.railway.app";

export async function apiCall(method, endpoint, body = null, isFormData = false) {
    const auth_token = localStorage.getItem("auth_token") || "";
    const headers = {};

    if (auth_token) {
        headers["Authorization"] = `Bearer ${auth_token}`;
    }

    if (!isFormData) {
        headers["Content-Type"] = "application/json";
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        if (isFormData) {
            options.body = body; // body is FormData
        } else {
            options.body = JSON.stringify(body);
        }
    }

    const response = await fetch(`${api_base}${endpoint}`, options);

    if (response.status === 401) {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
        throw new Error("Unauthorized");
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = `Request failed with status ${response.status}`;
        
        if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' 
                ? errorData.detail 
                : JSON.stringify(errorData.detail);
        }
        
        throw new Error(errorMessage);
    }

    return response.json();
}
