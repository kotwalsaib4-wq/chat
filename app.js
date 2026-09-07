const socket = io();

const statusEl = document.getElementById("status");
const receiverPanel = document.getElementById("receiverPanel");
const callerPanel = document.getElementById("callerPanel");
const incomingPanel = document.getElementById("incomingPanel");
const callPanel = document.getElementById("callPanel");

const receiverStart = document.getElementById("receiverStart");
const callButton = document.getElementById("callButton");
const acceptButton = document.getElementById("acceptButton");
const rejectButton = document.getElementById("rejectButton");
const hangupButton = document.getElementById("hangupButton");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const params = new URLSearchParams(location.search);
const role = params.get("role") === "receiver" ? "receiver" : "caller";

let peer = null;
let localStream = null;
let remotePeerId = null;
let pendingCallerId = null;

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" }
  ]
};

function setStatus(text) {
  statusEl.textContent = text;
}

function show(el) {
  el.classList.remove("hidden");
}

function hide(el) {
  el.classList.add("hidden");
}

socket.on("connect", () => {
  socket.emit("register", role);

  if (role === "receiver") {
    show(receiverPanel);
    setStatus("Receiver online. Keep this page open.");
  } else {
    show(callerPanel);
    setStatus("Ready. Press the button to request a call.");
  }
});

socket.on("incoming-call", ({ callerId }) => {
  if (role !== "receiver") return;

  pendingCallerId = callerId;
  show(incomingPanel);
  setStatus("Incoming call request.");
  playRing();
});

socket.on("call-accepted", async ({ receiverId }) => {
  if (role !== "caller") return;

  remotePeerId = receiverId;
  setStatus("Call accepted. Requesting camera and microphone…");

  try {
    await startMedia();
    createPeer();
    addLocalTracks();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("webrtc-offer", {
      target: remotePeerId,
      offer: peer.localDescription
    });

    show(callPanel);
    setStatus("Calling…");
  } catch (err) {
    console.error(err);
    setStatus("Camera/microphone permission was not granted.");
  }
});

socket.on("call-rejected", () => {
  setStatus("Call request was rejected.");
});

socket.on("webrtc-offer", async ({ from, offer }) => {
  if (role !== "receiver") return;

  remotePeerId = from;

  try {
    await startMedia();
    createPeer();
    addLocalTracks();

    await peer.setRemoteDescription(offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("webrtc-answer", {
      target: remotePeerId,
      answer: peer.localDescription
    });

    hide(incomingPanel);
    show(callPanel);
    setStatus("Live call connected.");
  } catch (err) {
    console.error(err);
    setStatus("Unable to start the call.");
  }
});

socket.on("webrtc-answer", async ({ answer }) => {
  if (!peer) return;
  await peer.setRemoteDescription(answer);
  setStatus("Live call connected.");
});

socket.on("ice-candidate", async ({ candidate }) => {
  if (!peer || !candidate) return;
  try {
    await peer.addIceCandidate(candidate);
  } catch (err) {
    console.warn("ICE candidate error:", err);
  }
});

socket.on("hangup", () => {
  cleanupCall();
  setStatus("The other person ended the call.");
});

receiverStart.addEventListener("click", async () => {
  try {
    await startMedia();
    stopLocalMedia();
    receiverStart.disabled = true;
    receiverStart.textContent = "Receiver Enabled";
    setStatus("Receiver enabled. Waiting for a call…");
  } catch {
    setStatus("You can enable camera/microphone when you accept a call.");
  }
});

callButton.addEventListener("click", () => {
  callButton.disabled = true;
  setStatus("Sending call request…");
  socket.emit("call-request");
});

acceptButton.addEventListener("click", () => {
  if (!pendingCallerId) return;

  socket.emit("call-accepted", { callerId: pendingCallerId });
  hide(incomingPanel);
  setStatus("Call accepted. Waiting for connection…");
});

rejectButton.addEventListener("click", () => {
  if (!pendingCallerId) return;

  socket.emit("call-rejected", { callerId: pendingCallerId });
  pendingCallerId = null;
  hide(incomingPanel);
  setStatus("Call rejected.");
});

hangupButton.addEventListener("click", () => {
  if (remotePeerId) {
    socket.emit("hangup", { target: remotePeerId });
  }
  cleanupCall();
  setStatus("Call ended.");
  if (role === "caller") callButton.disabled = false;
});

async function startMedia() {
  if (localStream) return localStream;

  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  });

  localVideo.srcObject = localStream;
  return localStream;
}

function createPeer() {
  if (peer) peer.close();

  peer = new RTCPeerConnection(rtcConfig);

  peer.onicecandidate = (event) => {
    if (event.candidate && remotePeerId) {
      socket.emit("ice-candidate", {
        target: remotePeerId,
        candidate: event.candidate
      });
    }
  };

  peer.ontrack = (event) => {
    if (event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  peer.onconnectionstatechange = () => {
    const state = peer.connectionState;
    if (state === "connected") setStatus("Live call connected.");
    if (["failed", "disconnected", "closed"].includes(state)) {
      setStatus("Call connection ended.");
    }
  };
}

function addLocalTracks() {
  if (!peer || !localStream) return;

  for (const track of localStream.getTracks()) {
    peer.addTrack(track, localStream);
  }
}

function cleanupCall() {
  if (peer) {
    peer.close();
    peer = null;
  }

  remoteVideo.srcObject = null;
  stopLocalMedia();
  remotePeerId = null;
  pendingCallerId = null;

  hide(callPanel);
  hide(incomingPanel);
}

function stopLocalMedia() {
  if (!localStream) return;

  localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  localVideo.srcObject = null;
}

function playRing() {
  // Browser-safe notification sound. It only runs after a call request.
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 880;
    gain.gain.value = 0.08;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 500);
  } catch (_) {}
}
