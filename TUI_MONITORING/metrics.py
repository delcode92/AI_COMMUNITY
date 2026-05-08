import json, psutil, time, os

def get_metrics():
    # Uptime in seconds since boot
    uptime = time.time() - psutil.boot_time()
    # CPU percentages per core and overall average
    cpu_percent = psutil.cpu_percent(percpu=True, interval=0.1)
    cpu_total = sum(cpu_percent) / len(cpu_percent)
    # Load average (1,5,15 min) – only on Unix
    try:
        load_avg = os.getloadavg()
    except Exception:
        load_avg = (0.0, 0.0, 0.0)
    # Memory stats
    vm = psutil.virtual_memory()
    swap = psutil.swap_memory()
    # Network I/O counters since boot
    net_io = psutil.net_io_counters()
    # Number of TCP connections (simplified count)
    try:
        connections = len(psutil.net_connections())
    except psutil.AccessDenied:
        connections = 0
    return {
        "uptime": int(uptime),
        "cpuTotal": int(cpu_total),
        "cpuPercent": [int(p) for p in cpu_percent],
        "loadAvg": [round(v, 2) for v in load_avg],
        "ramTotal": round(vm.total / (1024**3), 1),  # GB
        "ramUsed": round(vm.used / (1024**3), 1),
        "ramPercent": int(vm.percent),
        "swapTotal": round(swap.total / (1024**3), 1),
        "swapUsed": round(swap.used / (1024**3), 1),
        "swapPercent": int(swap.percent),
        "networkSent": net_io.bytes_sent,
        "networkRecv": net_io.bytes_recv,
        "connections": connections,
    }

if __name__ == "__main__":
    print(json.dumps(get_metrics()))
