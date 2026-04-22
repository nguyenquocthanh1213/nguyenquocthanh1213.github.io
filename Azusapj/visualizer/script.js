const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
const radius = 200; // Bán kính vòng tròn
const numBars = 50; // Số lượng bars
const bassThreshold = 0.5; // Ngưỡng bass để kích hoạt domino
let dominoActive = false;
let dominoProgress = 0;
const dominoSpeed = 0.01; // Tốc độ domino
let audioContext;
let analyser;
let dataArray;

// Khởi tạo audio
async function initAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // Kích thước FFT
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        draw();
    } catch (err) {
        console.error('Lỗi truy cập micro:', err);
    }
}

initAudio();

// Hàm vẽ chính
function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    // Xóa canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Di chuyển gốc tọa độ về giữa canvas
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Tính bass, mid, high (năng lượng trung bình)
    const bass = getAverageEnergy(0, 10); // Bass: bin 0-10 (~20-200Hz)
    const mid = getAverageEnergy(10, 50); // Mid: bin 10-50 (~200-2000Hz)
    const high = getAverageEnergy(50, 100); // High: bin 50-100 (>2000Hz)

    // Chuẩn hóa về 0-1
    const normalizedBass = bass / 255;
    const normalizedMid = mid / 255;
    const normalizedHigh = high / 255;

    // Kích hoạt domino nếu bass mạnh
    if (normalizedBass > bassThreshold && !dominoActive) {
        dominoActive = true;
        dominoProgress = 0;
    }

    // Cập nhật tiến trình domino
    if (dominoActive) {
        dominoProgress += dominoSpeed;
        if (dominoProgress >= 1) {
            dominoActive = false;
        }
    }

    // Vẽ nửa phải
    drawHalfCircle(normalizedBass, normalizedMid, normalizedHigh, true);

    // Vẽ nửa trái (đối xứng)
    ctx.save();
    ctx.scale(-1, 1); // Lật theo trục x
    drawHalfCircle(normalizedBass, normalizedMid, normalizedHigh, false);
    ctx.restore();

    ctx.restore();
}

// Hàm tính năng lượng trung bình cho dải tần
function getAverageEnergy(startBin, endBin) {
    let sum = 0;
    for (let i = startBin; i < endBin; i++) {
        sum += dataArray[i];
    }
    return sum / (endBin - startBin);
}

// Hàm vẽ nửa vòng tròn
function drawHalfCircle(bass, mid, high, isRight) {
    // Vẽ viền nửa vòng tròn (tùy chọn, để tham chiếu)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Vẽ bars (kết hợp bass, mid, high)
    for (let i = 0; i < numBars; i++) {
        const angle = map(i, 0, numBars - 1, -Math.PI / 2, Math.PI / 2);
        let barHeight;

        // Phân bổ chiều cao: bass mạnh (max 150), mid/high nhỏ (max 50)
        if (i < numBars / 3) { // Phần dưới: bass
            barHeight = bass * 150; // Bass mạnh
        } else if (i < (2 * numBars) / 3) { // Phần giữa: mid
            barHeight = mid * 50; // Mid nhỏ
        } else { // Phần trên: high
            barHeight = high * 50; // High nhỏ
        }

        // Hiệu ứng domino cho bass: Chỉ vẽ nếu tiến trình đã đến
        const barProgress = map(i, 0, numBars - 1, 0, 1);
        if (dominoActive && barProgress > dominoProgress) {
            barHeight = 0; // Chưa đến lượt, ẩn bar
        }

        // Tăng chiều cao dần dần cho domino (càng lên càng cao)
        if (dominoActive && barProgress <= dominoProgress) {
            barHeight += map(i, 0, numBars - 1, 0, 100); // Thêm chiều cao tăng dần
        }

        // Tính vị trí
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const endX = (radius + barHeight) * Math.cos(angle);
        const endY = (radius + barHeight) * Math.sin(angle);

        // Vẽ bar
        ctx.strokeStyle = isRight ? '#0f0' : '#00f'; // Màu khác nhau để phân biệt (xanh phải, xanh dương trái)
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
}

// Hàm map (tương tự p5.js)
function map(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}