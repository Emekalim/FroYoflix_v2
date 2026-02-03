const _eventListeners = new Map()
const WPC = {
  send: (event, data) => window.dispatchEvent(new CustomEvent(event, { detail: data })),
  listen: (event, callback) => {
    const wrapper = _event => callback(_event?.detail)
    window.addEventListener(event, wrapper)
    _eventListeners.set(callback, wrapper)
    return wrapper
  },
  clear: (event, callback) => {
    const wrapper = _eventListeners.get(callback)
    if (!wrapper) return
    window.removeEventListener(event, wrapper)
    _eventListeners.delete(callback)
  }
}

export default WPC