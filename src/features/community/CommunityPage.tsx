import { Route, Routes } from "react-router";
import { TimezoneProvider } from "../calendar/TimezoneContext.tsx";
import { PostListPage } from "./PostListPage.tsx";
import { PostDetailPage } from "./PostDetailPage.tsx";

export function CommunityRoutes() {
  return (
    <TimezoneProvider>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Routes>
          <Route index element={<PostListPage />} />
          <Route path=":postId" element={<PostDetailPage />} />
        </Routes>
      </div>
    </TimezoneProvider>
  );
}

export default CommunityRoutes;
