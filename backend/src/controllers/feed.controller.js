import Group from "../models/group.model.js";
import Post from "../models/post.model.js";
import Comment from "../models/comment.model.js";

export async function getFeed(req, res, next) {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("groupId", "name description")
      .populate("authorId", "name");

    return res.json({
      posts: posts.map((p) => ({
        id: p._id,
        group: p.groupId,
        author: p.authorId,
        title: p.title,
        content: p.content,
        likesCount: p.likedBy.length,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function getThread(req, res, next) {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate("groupId", "name description")
      .populate("authorId", "name");
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comments = await Comment.find({ postId }).sort({ createdAt: 1 }).populate("authorId", "name");

    return res.json({
      post: {
        id: post._id,
        group: post.groupId,
        author: post.authorId,
        title: post.title,
        content: post.content,
        likesCount: post.likedBy.length,
        createdAt: post.createdAt,
      },
      comments: comments.map((c) => ({
        id: c._id,
        author: c.authorId,
        content: c.content,
        parentCommentId: c.parentCommentId,
        likesCount: c.likedBy.length,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function openGroups(req, res, next) {
  try {
    const groups = await Group.find().sort({ createdAt: -1 }).limit(50);
    return res.json({ groups });
  } catch (err) {
    return next(err);
  }
}

