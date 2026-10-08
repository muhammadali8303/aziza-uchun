(() => {
    "use strict";

    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    const overlay = document.getElementById("overlay");
    const startButton = document.getElementById("start-button");
    const scoreLabel = document.getElementById("score");
    const distanceLabel = document.getElementById("distance");
    const livesLabel = document.getElementById("lives");
    const levelLabel = document.getElementById("level");
    const boostFill = document.getElementById("boost-fill");
    const bestLabel = document.getElementById("best-score");
    const dialogEmoji = document.getElementById("dialog-emoji");
    const dialogPhoto = document.getElementById("dialog-photo");
    const dialogTitle = document.getElementById("dialog-title");
    const dialogText = document.getElementById("dialog-text");
    const titleSticker = document.querySelector(".title-sticker");
    const azizaImage = new Image();
    azizaImage.src = "./aziza.jpg";
    const cobaltImage = new Image();
    cobaltImage.src = "./cobalt.jpg";

    function hideImageOnError(image, container) {
        const hide = () => { container.hidden = true; };
        image.addEventListener("error", hide, { once: true });
        if (image.complete && !image.naturalWidth) hide();
    }

    hideImageOnError(titleSticker, titleSticker.closest(".title-sticker-frame"));
    hideImageOnError(dialogPhoto, dialogPhoto);

    const laneCount = 3;
    const maxBoost = 100;
    const player = { lane: 1, x: 0, y: 0, invulnerable: 0 };
    const objects = [];
    const flowers = [];
    let width = 0;
    let height = 0;
    let dpr = 1;
    let state = "ready";
    let score = 0;
    let distance = 0;
    let lives = 3;
    let boost = 0;
    let boosting = false;
    let boostTime = 0;
    let elapsed = 0;
    let spawnTimer = 0;
    let objectCount = 0;
    let roadScroll = 0;
    let lastTime = 0;
    let best = Number(localStorage.getItem("yulduzli-yol-best") || 0);
    let touchStartX = null;

    bestLabel.textContent = String(best);

    function resize() {
        const bounds = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = bounds.width;
        height = bounds.height;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        player.y = height - Math.max(93, height * 0.19);
        if (player.x === 0) player.x = laneCenter(player.lane, player.y);
        draw();
    }

    function roadCenter(y) {
        const curve = Math.sin((y / Math.max(height, 1)) * 2.1 + elapsed * 0.22);
        return width / 2 + curve * Math.min(width * 0.035, 28);
    }

    function roadWidth() {
        return Math.min(width * 0.72, 450);
    }

    function laneCenter(lane, y) {
        const laneWidth = roadWidth() / laneCount;
        return roadCenter(y) - roadWidth() / 2 + laneWidth * (lane + 0.5);
    }

    function updateHud() {
        scoreLabel.textContent = String(score);
        distanceLabel.textContent = String(Math.floor(distance));
        livesLabel.textContent = "💗".repeat(lives) + "🩶".repeat(3 - lives);
        livesLabel.setAttribute("aria-label", `${lives} ta jon`);
        levelLabel.textContent = `${Math.floor(distance / 150) + 1}-daraja`;
        boostFill.style.width = `${boost}%`;
    }

    function showOverlay(kind) {
        overlay.classList.remove("hidden");
        dialogPhoto.hidden = true;
        if (kind === "ready") {
            dialogEmoji.textContent = "🌷";
            dialogTitle.textContent = "Sayohatga tayyormisan?";
            dialogText.textContent = "Shirin mashinangni boshqar, yo‘ldagi to‘siqlardan qoch va yulduzlarni yig‘!";
            startButton.textContent = "Boshladik! ✨";
        } else if (kind === "paused") {
            dialogEmoji.textContent = "⏸️";
            dialogTitle.textContent = "Bir oz dam olamiz";
            dialogText.textContent = "Sayohating shu yerda kutib turibdi. Tayyor bo‘lsang davom et!";
            startButton.textContent = "Davom etish ▶";
        } else {
            dialogPhoto.hidden = lives > 0;
            dialogEmoji.textContent = lives > 0 ? "🎉" : "💖";
            dialogTitle.textContent = lives > 0 ? "Ajoyib sayohat!" : "Yana bir bor urinib ko‘r AZIZA   !";
            dialogText.textContent = ` ${Math.floor(distance)} metr yo‘l bosding va ${score} ta yulduz yig‘ding. ${score > best ? "Yangi rekord! Sen zo‘rsan!" : "Keyingi safar yanada uzoqqa borasan!"}`;
            startButton.textContent = "Qayta o‘ynash ↻";
        }
    }

    function startGame() {
        score = 0;
        distance = 0;
        lives = 3;
        boost = 0;
        boosting = false;
        boostTime = 0;
        elapsed = 0;
        spawnTimer = 0.3;
        objectCount = 0;
        roadScroll = 0;
        player.lane = 1;
        player.x = laneCenter(player.lane, player.y);
        player.invulnerable = 0;
        objects.length = 0;
        state = "playing";
        overlay.classList.add("hidden");
        updateHud();
    }

    function moveLane(direction) {
        if (state !== "playing") return;
        player.lane = Math.max(0, Math.min(laneCount - 1, player.lane + direction));
    }

    function activateBoost() {
        if (state === "playing" && boost >= 100) {
            boost = 0;
            boostTime = 2.5;
            player.invulnerable = Math.max(player.invulnerable, 2.5);
            updateHud();
        }
    }

    function spawnObject() {
        const lane = Math.floor(Math.random() * laneCount);
        objectCount += 1;
        if (objectCount % 4 === 0) {
            objects.push({ type: "star", lane, y: -34, spin: Math.random() * Math.PI * 2 });
            return;
        }
        const hazardLane = lane;
        objects.push({ type: "hazard", lane: hazardLane, y: -42, kind: Math.random() > 0.5 ? "cone" : "flower" });
        if (objectCount % 3 === 0) {
            const starLane = (hazardLane + 1 + Math.floor(Math.random() * 2)) % laneCount;
            objects.push({ type: "star", lane: starLane, y: -132, spin: Math.random() * Math.PI * 2 });
        }
    }

    function update(dt) {
        elapsed += dt;
        roadScroll = (roadScroll + dt * (220 + Math.min(distance, 600) * 0.18)) % 72;
        for (let i = flowers.length - 1; i >= 0; i -= 1) {
            flowers[i].y += dt * 100;
            if (flowers[i].y > height + 15) flowers.splice(i, 1);
        }
        if (flowers.length < 24) {
            flowers.push({
                x: Math.random() < 0.5 ? Math.random() * width * 0.13 : width * 0.87 + Math.random() * width * 0.13,
                y: -12,
                size: 3 + Math.random() * 4,
                color: ["#f3a9c9", "#ffcf86", "#fff0a5", "#b5d9ae"][Math.floor(Math.random() * 4)]
            });
        }
        if (state !== "playing") return;

        const baseSpeed = 280 + Math.min(distance, 750) * 0.22;
        const speed = baseSpeed * (boostTime > 0 ? 1.32 : 1);
        distance += dt * (boostTime > 0 ? 22 : 16);
        player.invulnerable = Math.max(0, player.invulnerable - dt);
        if (boostTime > 0) boostTime = Math.max(0, boostTime - dt);
        if (boosting && boost >= 100) activateBoost();

        const targetX = laneCenter(player.lane, player.y);
        player.x += (targetX - player.x) * Math.min(1, dt * 13);

        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            spawnObject();
            spawnTimer = Math.max(0.52, 0.96 - distance / 1600) + Math.random() * 0.18;
        }

        for (let i = objects.length - 1; i >= 0; i -= 1) {
            const item = objects[i];
            item.y += speed * dt;
            item.spin = (item.spin || 0) + dt * 3;
            const itemX = laneCenter(item.lane, item.y);
            if (Math.abs(item.y - player.y) < 35 && Math.abs(itemX - player.x) < roadWidth() / laneCount * 0.38) {
                if (item.type === "star") {
                    score += 1;
                    boost = Math.min(maxBoost, boost + 20);
                } else if (player.invulnerable <= 0) {
                    lives -= 1;
                    player.invulnerable = 1.25;
                    if (lives <= 0) {
                        state = "over";
                        boosting = false;
                        if (score > best) {
                            best = score;
                            localStorage.setItem("yulduzli-yol-best", String(best));
                            bestLabel.textContent = String(best);
                        }
                        showOverlay("over");
                    }
                }
                objects.splice(i, 1);
                continue;
            }
            if (item.y > height + 60) objects.splice(i, 1);
        }
        updateHud();
    }

    function drawBackground() {
        ctx.fillStyle = "#dff1df";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#e8f4e2";
        ctx.fillRect(0, 0, width * 0.12, height);
        ctx.fillRect(width * 0.88, 0, width * 0.12, height);
        flowers.forEach((flower) => {
            ctx.fillStyle = flower.color;
            ctx.beginPath();
            ctx.arc(flower.x, flower.y, flower.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff6cf";
            ctx.beginPath();
            ctx.arc(flower.x, flower.y, flower.size * 0.35, 0, Math.PI * 2);
            ctx.fill();
        });

        const left = roadCenter(0) - roadWidth() / 2;
        const right = roadCenter(0) + roadWidth() / 2;
        ctx.fillStyle = "#968c9d";
        ctx.beginPath();
        ctx.moveTo(left, 0);
        ctx.lineTo(right, 0);
        for (let y = 0; y <= height; y += 12) ctx.lineTo(roadCenter(y) + roadWidth() / 2, y);
        for (let y = height; y >= 0; y -= 12) ctx.lineTo(roadCenter(y) - roadWidth() / 2, y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#fff8e4";
        ctx.lineWidth = 5;
        for (let side = -1; side <= 1; side += 2) {
            ctx.beginPath();
            for (let y = 0; y <= height; y += 12) {
                const x = roadCenter(y) + side * roadWidth() / 2;
                if (y === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.strokeStyle = "#d4c9d5";
        ctx.lineWidth = 3;
        ctx.setLineDash([22, 24]);
        ctx.lineDashOffset = -roadScroll;
        for (let lane = 1; lane < laneCount; lane += 1) {
            ctx.beginPath();
            for (let y = 0; y <= height; y += 12) {
                const x = roadCenter(y) - roadWidth() / 2 + roadWidth() * lane / laneCount;
                if (y === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    function drawStar(x, y, radius, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.beginPath();
        for (let point = 0; point < 10; point += 1) {
            const angle = -Math.PI / 2 + point * Math.PI / 5;
            const r = point % 2 === 0 ? radius : radius * 0.46;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (point === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = "#ffce66";
        ctx.fill();
        ctx.strokeStyle = "#fff2bb";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    function drawHazard(item, x) {
        ctx.save();
        ctx.translate(x, item.y);
        ctx.fillStyle = "#00000024";
        ctx.beginPath();
        ctx.ellipse(0, 15, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        if (item.kind === "cone") {
            ctx.fillStyle = "#f39479";
            ctx.beginPath();
            ctx.moveTo(0, -18);
            ctx.lineTo(16, 15);
            ctx.lineTo(-16, 15);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "#fff6df";
            ctx.fillRect(-9, 2, 18, 5);
            ctx.fillStyle = "#dc7869";
            ctx.fillRect(-20, 13, 40, 6);
        } else {
            ctx.font = "34px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🌳", 0, 0);
        }
        ctx.restore();
    }

    function drawCobalt(x, y, carWidth, carHeight) {
        const radius = Math.min(9, carHeight * 0.2);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + carWidth - radius, y);
        ctx.quadraticCurveTo(x + carWidth, y, x + carWidth, y + radius);
        ctx.lineTo(x + carWidth, y + carHeight - radius);
        ctx.quadraticCurveTo(x + carWidth, y + carHeight, x + carWidth - radius, y + carHeight);
        ctx.lineTo(x + radius, y + carHeight);
        ctx.quadraticCurveTo(x, y + carHeight, x, y + carHeight - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(cobaltImage, 35, 330, 880, 650, x, y, carWidth, carHeight);
        ctx.restore();
    }

    function drawCar() {
        const x = player.x;
        const y = player.y;
        if (player.invulnerable > 0 && Math.floor(elapsed * 12) % 2 === 0) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "#00000035";
        ctx.beginPath();
        ctx.ellipse(0, 18, 25, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        if (boostTime > 0) {
            ctx.fillStyle = "#b1e7ed";
            ctx.beginPath();
            ctx.ellipse(0, 0, 32, 45, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (cobaltImage.complete && cobaltImage.naturalWidth) {
            const carWidth = Math.min(72, Math.max(48, roadWidth() / laneCount * 0.58));
            const carHeight = carWidth * 0.74;
            drawCobalt(-carWidth / 2, -carHeight / 2, carWidth, carHeight);
            ctx.restore();
            return;
        }
        ctx.fillStyle = "#584752";
        ctx.fillRect(-22, -19, 7, 16);
        ctx.fillRect(15, -19, 7, 16);
        ctx.fillRect(-22, 14, 7, 14);
        ctx.fillRect(15, 14, 7, 14);
        ctx.fillStyle = "#ee76a9";
        ctx.beginPath();
        ctx.moveTo(-18, -27);
        ctx.quadraticCurveTo(-18, -34, -11, -34);
        ctx.lineTo(11, -34);
        ctx.quadraticCurveTo(18, -34, 18, -27);
        ctx.lineTo(21, 22);
        ctx.quadraticCurveTo(20, 30, 13, 30);
        ctx.lineTo(-13, 30);
        ctx.quadraticCurveTo(-20, 30, -21, 22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff1f6";
        ctx.beginPath();
        ctx.moveTo(-12, -20);
        ctx.quadraticCurveTo(-10, -25, -5, -25);
        ctx.lineTo(5, -25);
        ctx.quadraticCurveTo(10, -25, 12, -20);
        ctx.lineTo(14, -7);
        ctx.lineTo(-14, -7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#b9e2e7";
        ctx.beginPath();
        ctx.moveTo(-13, -5);
        ctx.lineTo(13, -5);
        ctx.lineTo(15, 9);
        ctx.lineTo(-15, 9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff6c8";
        ctx.fillRect(-15, 22, 7, 4);
        ctx.fillRect(8, 22, 7, 4);
        ctx.fillStyle = "#e54f82";
        ctx.beginPath();
        ctx.arc(0, 15, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawCollectible(x, y) {
        const size = Math.min(52, Math.max(40, width * 0.09));
        if (!azizaImage.complete || !azizaImage.naturalWidth) {
            drawStar(x, y, size * 0.34, 0);
            return;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "#00000030";
        ctx.beginPath();
        ctx.ellipse(0, size * 0.55, size * 0.48, size * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.52, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.46, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(azizaImage, 150, 145, 200, 200, -size * 0.46, -size * 0.46, size * 0.92, size * 0.92);
        ctx.restore();
    }

    function draw() {
        if (!width || !height) return;
        drawBackground();
        objects.forEach((item) => {
            const x = laneCenter(item.lane, item.y);
            if (item.type === "star") drawCollectible(x, item.y);
            else drawHazard(item, x);
        });
        drawCar();
    }

    function frame(time) {
        const dt = Math.min((time - lastTime) / 1000 || 0, 0.04);
        lastTime = time;
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }

    function pauseGame() {
        if (state === "playing") {
            state = "paused";
            boosting = false;
            showOverlay("paused");
        }
    }

    startButton.addEventListener("click", () => {
        if (state === "paused") {
            state = "playing";
            overlay.classList.add("hidden");
        } else {
            startGame();
        }
    });

    window.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if (["arrowleft", "arrowright", " ", "arrowup"].includes(key)) event.preventDefault();
        if (key === "arrowleft" || key === "a") moveLane(-1);
        if (key === "arrowright" || key === "d") moveLane(1);
        if (key === " " || key === "arrowup") {
            boosting = true;
            activateBoost();
        }
        if (key === "p" && (state === "playing" || state === "paused")) {
            if (state === "playing") pauseGame();
            else {
                state = "playing";
                overlay.classList.add("hidden");
            }
        }
    });
    window.addEventListener("keyup", (event) => {
        if (event.key === " " || event.key === "ArrowUp") boosting = false;
    });
    window.addEventListener("blur", () => {
        boosting = false;
        if (state === "playing") pauseGame();
    });

    document.getElementById("left-button").addEventListener("click", () => moveLane(-1));
    document.getElementById("right-button").addEventListener("click", () => moveLane(1));
    const boostButton = document.getElementById("boost-button");
    boostButton.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        boosting = true;
        activateBoost();
    });
    boostButton.addEventListener("pointerup", () => { boosting = false; });
    boostButton.addEventListener("pointercancel", () => { boosting = false; });
    boostButton.addEventListener("pointerleave", () => { boosting = false; });

    canvas.addEventListener("touchstart", (event) => {
        touchStartX = event.changedTouches[0].clientX;
    }, { passive: true });
    canvas.addEventListener("touchend", (event) => {
        if (touchStartX === null) return;
        const delta = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) > 28) moveLane(delta < 0 ? -1 : 1);
        touchStartX = null;
    }, { passive: true });

    window.addEventListener("resize", resize);
    resize();
    updateHud();
    requestAnimationFrame(frame);
})();