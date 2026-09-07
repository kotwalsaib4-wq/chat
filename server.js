const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "webrtc-live-call" });
});

io.on("connection", (socket) => {
  socket.on("register", (role) => {
    if (role !== "caller" && role !== "receiver") return;
    socket.data.role = role;
    socket.join(role);
  });

  socket.on("call-request", () => {
    io.to("receiver").emit("incoming-call", { callerId: socket.id });
  });

  socket.on("call-accepted", ({ callerId }) => {
    if (!callerId) return;
    io.to(callerId).emit("call-accepted", { receiverId: socket.id });
  });

  socket.on("call-rejected", ({ callerId }) => {
    if (!callerId) return;
    io.to(callerId).emit("call-rejected");
  });

  socket.on("webrtc-offer", ({ target, offer }) => {
    if (target && offer) io.to(target).emit("webrtc-offer", { from: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ target, answer }) => {
    if (target && answer) io.to(target).emit("webrtc-answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ target, candidate }) => {
    if (target && candidate) io.to(target).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("hangup", ({ target }) => {
    if (target) io.to(target).emit("hangup");
  });

  socket.on("disconnect", () => {
    if (socket.data.role === "receiver") {
      io.emit("receiver-offline");
    }
  });
});

server.listen(PORT, () => {
  console.log(`WebRTC Live Call running on port ${PORT}`);
});
