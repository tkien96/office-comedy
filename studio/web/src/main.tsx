import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfigPage } from "./ConfigPage";
import { SocialConnections } from "./SocialConnections";
import { EpisodeDetail } from "./EpisodeDetail";
import { EpisodeList } from "./EpisodeList";
import { NewEpisodePage } from "./NewEpisodePage";
import { TasksPage } from "./TasksPage";
import { ToastProvider } from "./ui";

// Office Comedy Studio — hash routes:
//   #/                       danh sách tập
//   #/tap/EP001/<tab>        chi tiết tập
//   #/tao-tap                tạo tập mới (ý tưởng → Claude viết nháp)
//   #/cong-viec              công việc nền
//   #/cau-hinh               cấu hình
//   #/cau-hinh/ket-noi       kết nối mạng xã hội (?r=<id> sau khi Google chuyển về)

const useHash = () => {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
};

const App: React.FC = () => {
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
  let page: React.ReactNode;
  let active = "list";
  if (parts[0] === "tap" && parts[1] && /^EP\d{3,}$/.test(parts[1])) page = <EpisodeDetail key={parts[1]} id={parts[1]} tab={parts[2] ?? "tong-quan"} />;
  else if (parts[0] === "tao-tap") {
    page = <NewEpisodePage />;
    active = "new";
  } else if (parts[0] === "cau-hinh" && parts[1] === "ket-noi") {
    page = <SocialConnections />;
    active = "social";
  } else if (parts[0] === "cau-hinh") {
    page = <ConfigPage />;
    active = "config";
  } else if (parts[0] === "cong-viec") {
    page = <TasksPage />;
    active = "tasks";
  } else page = <EpisodeList />;

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Điều hướng chính">
        <div className="brand">
          Office Comedy <span>Studio</span>
        </div>
        <a className={active === "list" ? "nav active" : "nav"} href="#/">
          Danh sách tập
        </a>
        <a className={active === "new" ? "nav active" : "nav"} href="#/tao-tap">
          Tạo tập mới
        </a>
        <a className={active === "tasks" ? "nav active" : "nav"} href="#/cong-viec">
          Công việc nền
        </a>
        <a className={active === "config" ? "nav active" : "nav"} href="#/cau-hinh">
          Cấu hình
        </a>
        <a className={active === "social" ? "nav nav-sub active" : "nav nav-sub"} href="#/cau-hinh/ket-noi">
          Kết nối mạng xã hội
        </a>
        <div className="sidebar-note">Chạy trên máy này (127.0.0.1). Chưa có TTS, render hay đăng bài từ giao diện.</div>
      </nav>
      <main className="content">{page}</main>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
);
