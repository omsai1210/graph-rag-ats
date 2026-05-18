const api_base = "https://graph-rag-ats.up.railway.app"

export const apiCall = async (method, endpoint, body = null, isFormData = false) => {
  const url = `${api_base}${endpoint}`
  
  const headers = {}
  
  const token = localStorage.getItem("auth_token")
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  
  if (!isFormData) {
    headers["Content-Type"] = "application/json"
  }
  
  const options = {
    method,
    headers,
  }
  
  if (body) {
    options.body = isFormData ? body : JSON.stringify(body)
  }
  
  const response = await fetch(url, options)
  
  if (response.status === 401) {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("current_user")
    window.location.href = "/login"
    return
  }
  
  return response.json()
}

export default apiCall
