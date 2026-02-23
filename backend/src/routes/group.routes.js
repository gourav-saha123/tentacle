import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  addComment,
  createGroup,
  createPost,
  getGroup,
  joinGroup,
  leaveGroup,
  listComments,
  listGroups,
  listPosts,
  recommendedGroups,
  toggleCommentLike,
  togglePostLike,
} from "../controllers/group.controller.js";

const router = Router();

router.get("/", requireAuth, listGroups);
router.post("/", requireAuth, createGroup);
router.get("/recommended", requireAuth, recommendedGroups);
router.get("/:groupId", requireAuth, getGroup);
router.post("/:groupId/join", requireAuth, joinGroup);
router.post("/:groupId/leave", requireAuth, leaveGroup);

router.get("/:groupId/posts", requireAuth, listPosts);
router.post("/:groupId/posts", requireAuth, createPost);
router.post("/:groupId/posts/:postId/like", requireAuth, togglePostLike);

router.get("/:groupId/posts/:postId/comments", requireAuth, listComments);
router.post("/:groupId/posts/:postId/comments", requireAuth, addComment);
router.post(
  "/:groupId/posts/:postId/comments/:commentId/like",
  requireAuth,
  toggleCommentLike,
);

export default router;

