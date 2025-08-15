document.addEventListener("DOMContentLoaded", () => {
    // --- CONFIGURATION CONSTANTS ---
    const DURATIONS = [120, 90, 60, 30, 15, 10, 5];
    const DURATION_TOOLTIPS = {
        120: "Two-hour deep-focus block — good for large, complex projects (take a longer break afterwards).",
        90: "Classic ultradian-aligned deep work — excellent for focused creative or learning sessions.",
        60: "Sustained attention for long-form work — balance intensity with a medium break.",
        30: "Great for time-boxed tasks and maintaining momentum without fatigue.",
        15: "Quick bursts to overcome inertia or do small but focused tasks.",
        10: "Micro-sprints for short chores or transitions between projects.",
        5: "Tiny bursts for micro-tasks — good for warmups and refocusing."
    };
    const BREAK_RECOMMENDATIONS = {
        120: [15, 20, 30],
        90: [15, 20],
        60: [10, 15],
        30: [5, 10],
        15: [3, 5],
        10: [2, 3],
        5: [1, 2]
    };

    // --- STATE MANAGEMENT ---
    // All state is stored in this object, similar to React's state
    let state = {
        selectedMinutes: 30,
        breakMinutes: null,
        running: false,
        secondsLeft: 30 * 60,
        elapsed: 0,
        tasks: [
            { id: 1, text: "Read article", done: false },
            { id: 2, text: "Write report", done: false }
        ],
        sessionsCompleted: 0,
        curvePoints: [],
    };

    // --- DOM ELEMENT REFERENCES ---
    // Get references to all the HTML elements we need to interact with
    const timeDisplay = document.getElementById("time-display");
    const progressRing = document.getElementById("progress-ring");
    const durationButtonsContainer = document.getElementById("duration-buttons");
    const durationTooltip = document.getElementById("duration-tooltip");
    const breakButtonsContainer = document.getElementById("break-buttons");
    const startStopBtn = document.getElementById("start-stop-btn");
    const resetBtn = document.getElementById("reset-btn");
    const sessionsCount = document.getElementById("sessions-count");
    const taskListContainer = document.getElementById("task-list");
    const newTaskInput = document.getElementById("new-task-input");
    const addTaskBtn = document.getElementById("add-task-btn");
    const graphPathBg = document.getElementById("graph-path-bg");
    const graphPathFg = document.getElementById("graph-path-fg");
    const graphDot = document.getElementById("graph-dot");
    const celebrationOverlay = document.getElementById("celebration-overlay");
    const emojiRainContainer = document.getElementById("emoji-rain-container");

    // --- GLOBALS FOR TIMER & AUDIO ---
    let rafRef = null; // requestAnimationFrame reference
    let startTimestamp = 0;
    const ringRadius = 52;
    const ringCircumference = 2 * Math.PI * ringRadius;

    // --- UTILITY FUNCTIONS ---
    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    function sampleProductivityCurve(minutes, samples = 200) {
        const tMax = minutes * 60;
        let peaks = 1;
        if (minutes >= 90) peaks = 3;
        else if (minutes >= 60) peaks = 2;

        const points = [];
        for (let i = 0; i <= samples; i++) {
            const t = (i / samples) * tMax;
            let y = 0;
            for (let p = 0; p < peaks; p++) {
                const center = ((p + 1) / (peaks + 1)) * tMax;
                const width = tMax / (peaks * 3.5);
                y += Math.exp(-Math.pow((t - center) / width, 2));
            }
            y *= 1 - 0.15 * (t / tMax);
            points.push({ x: i / samples, y });
        }
        const ys = points.map(p => p.y);
        const maxY = Math.max(...ys);
        return points.map(p => ({ x: p.x, y: p.y / maxY }));
    }

    // --- RENDERING FUNCTIONS ---
    // These functions update the UI based on the current state
    function render() {
        renderTimer();
        renderDurationButtons();
        renderBreakButtons();
        renderTasks();
        renderGraph();
        sessionsCount.textContent = state.sessionsCompleted;
        startStopBtn.textContent = state.running ? "Pause" : "Start";
    }

    function renderTimer() {
        const totalSeconds = state.selectedMinutes * 60;
        const fraction = totalSeconds > 0 ? state.elapsed / totalSeconds : 0;
        const offset = ringCircumference * (1 - fraction);

        timeDisplay.textContent = formatTime(state.secondsLeft);
        progressRing.style.strokeDasharray = ringCircumference;
        progressRing.style.strokeDashoffset = offset;
    }

    function renderDurationButtons() {
        durationButtonsContainer.innerHTML = "";
        DURATIONS.forEach(d => {
            const btn = document.createElement("button");
            btn.textContent = `${d} min`;
            btn.title = DURATION_TOOLTIPS[d];
            btn.className = `px-3 py-2 rounded-lg text-sm border ${state.selectedMinutes === d ? "bg-black text-white border-black" : "bg-gray-50 text-gray-800 border-gray-200"}`;
            btn.addEventListener("click", () => handleDurationChange(d));
            durationButtonsContainer.appendChild(btn);
        });
        durationTooltip.textContent = DURATION_TOOLTIPS[state.selectedMinutes];
    }
    
    function renderBreakButtons() {
        breakButtonsContainer.innerHTML = "";
        const recommendations = BREAK_RECOMMENDATIONS[state.selectedMinutes];
        recommendations.forEach(b => {
            const btn = document.createElement("button");
            btn.textContent = `${b} min`;
            btn.title = `Suggested ${b} minute break`;
            btn.className = `px-2 py-1 rounded-md text-sm border ${state.breakMinutes === b ? "bg-black text-white border-black" : "bg-gray-50 text-gray-800 border-gray-200"}`;
            btn.addEventListener("click", () => {
                state.breakMinutes = b;
                renderBreakButtons();
            });
            breakButtonsContainer.appendChild(btn);
        });
        // "No break" button
        const noBreakBtn = document.createElement("button");
        noBreakBtn.textContent = "No break";
        noBreakBtn.className = "px-2 py-1 rounded-md text-sm border bg-gray-50 text-gray-800 border-gray-200";
        noBreakBtn.addEventListener("click", () => {
             state.breakMinutes = 0;
             renderBreakButtons(); // Re-render to show selection
        });
        breakButtonsContainer.appendChild(noBreakBtn);
    }
    
    function renderTasks() {
        taskListContainer.innerHTML = "";
        state.tasks.forEach(task => {
            const label = document.createElement("label");
            label.className = "flex items-center gap-3 bg-white p-2 rounded-md border border-gray-100";
            
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = task.done;
            checkbox.className = "w-4 h-4";
            checkbox.addEventListener("change", () => toggleTask(task.id));

            const span = document.createElement("span");
            span.textContent = task.text;
            span.className = `text-sm ${task.done ? "line-through text-gray-400" : "text-gray-800"}`;

            label.appendChild(checkbox);
            label.appendChild(span);
            taskListContainer.appendChild(label);
        });
    }

    function renderGraph() {
        const graphWidth = 700, graphHeight = 120;

        function buildPath(points) {
            const coords = points.map(p => ({
                x: p.x * graphWidth,
                y: graphHeight - p.y * (graphHeight - 10) - 10
            }));
            function catmullRom2bezier(p) {
                const d = [];
                for (let i = 0; i < p.length - 1; i++) {
                    const p0 = p[i === 0 ? i : i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2 < p.length ? i + 2 : i + 1];
                    const bp1x = p1.x + (p2.x - p0.x) / 6, bp1y = p1.y + (p2.y - p0.y) / 6;
                    const bp2x = p2.x - (p3.x - p1.x) / 6, bp2y = p2.y - (p3.y - p1.y) / 6;
                    if (i === 0) d.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
                    d.push(`C ${bp1x.toFixed(2)} ${bp1y.toFixed(2)} ${bp2x.toFixed(2)} ${bp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
                }
                return d.join(" ");
            }
            return catmullRom2bezier(coords);
        }
        
        const pathD = buildPath(state.curvePoints);
        graphPathBg.setAttribute("d", pathD);
        graphPathFg.setAttribute("d", pathD);
        
        // Update dot position
        const totalSeconds = state.selectedMinutes * 60;
        const fraction = Math.min(1, totalSeconds > 0 ? state.elapsed / totalSeconds : 0);
        const index = Math.floor(fraction * (state.curvePoints.length - 1));
        const dotPoint = state.curvePoints[index] || state.curvePoints[0];
        if (dotPoint) {
            const dotX = dotPoint.x * graphWidth;
            const dotY = graphHeight - dotPoint.y * (graphHeight - 10) - 10;
            graphDot.setAttribute("cx", dotX);
            graphDot.setAttribute("cy", dotY);
        }
    }

    // --- EVENT HANDLERS & LOGIC ---
    function handleDurationChange(minutes) {
        state.selectedMinutes = minutes;
        resetTimer();
    }
    
    function resetTimer() {
        if (state.running) {
            state.running = false;
            cancelAnimationFrame(rafRef);
        }
        state.secondsLeft = state.selectedMinutes * 60;
        state.elapsed = 0;
        state.breakMinutes = null;
        state.curvePoints = sampleProductivityCurve(state.selectedMinutes);
        render(); // Full re-render
    }

    function startStop() {
        state.running = !state.running;
        if (state.running) {
            startTimestamp = performance.now() - state.elapsed * 1000;
            tick();
        } else {
            cancelAnimationFrame(rafRef);
        }
        startStopBtn.textContent = state.running ? "Pause" : "Start";
    }
    
    const tick = (now) => {
        if (!state.running) return;
        
        const elapsedSec = Math.max(0, (now - startTimestamp) / 1000);
        state.elapsed = elapsedSec;

        const totalSeconds = state.selectedMinutes * 60;
        const left = Math.max(0, Math.ceil(totalSeconds - elapsedSec));
        state.secondsLeft = left;

        if (elapsedSec >= totalSeconds) {
            state.running = false;
            state.elapsed = totalSeconds;
            state.secondsLeft = 0;
            state.sessionsCompleted++;
            sessionsCount.textContent = state.sessionsCompleted;
            startStopBtn.textContent = "Start";
            triggerCelebration();
        }
        
        // Only update the fast-changing parts of the UI
        renderTimer();
        renderGraph(); // Update dot position

        if (state.running) {
            rafRef = requestAnimationFrame(tick);
        }
    };
    
    function addTask() {
        const text = newTaskInput.value.trim();
        if (!text) return;
        state.tasks.push({ id: Date.now(), text, done: false });
        newTaskInput.value = "";
        renderTasks();
    }
    
    function toggleTask(id) {
        state.tasks = state.tasks.map(task => (task.id === id ? { ...task, done: !task.done } : task));
        renderTasks();
    }
    
    function triggerCelebration() {
        celebrationOverlay.classList.remove("hidden");
        playVictorySound();
        
        // Emoji rain effect
        emojiRainContainer.innerHTML = "";
        const emojis = ["🎉", "✨", "💪", "🔥", "🥳"];
        for (let i = 0; i < 18; i++) {
            const emoji = document.createElement("span");
            emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            emoji.style.position = "absolute";
            emoji.style.left = `${Math.random() * 100}%`;
            emoji.style.top = `-10%`;
            emoji.style.fontSize = `${14 + Math.random() * 20}px`;
            emoji.style.transform = `translateY(0) rotate(${Math.random() * 40 - 20}deg)`;
            emoji.style.animation = `fall 3.4s ${Math.random() * 0.6}s linear forwards`;
            emojiRainContainer.appendChild(emoji);
        }
        
        setTimeout(() => celebrationOverlay.classList.add("hidden"), 4200);
    }
    
    function playVictorySound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.setValueAtTime(880, ctx.currentTime);
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
            o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.24);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
            setTimeout(() => { o.stop(); try { ctx.close(); } catch (e) {} }, 1000);
        } catch (e) {
            console.error("Audio playback not supported.");
        }
    }

    // --- INITIALIZATION ---
    function init() {
        // Bind event listeners that don't change
        startStopBtn.addEventListener("click", startStop);
        resetBtn.addEventListener("click", resetTimer);
        addTaskBtn.addEventListener("click", addTask);
        newTaskInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') addTask();
        });
        
        // Initial state setup and render
        resetTimer();
    }
    
    init();
});