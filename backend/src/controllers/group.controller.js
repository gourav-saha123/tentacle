import Group from "../models/group.model.js";
import Post from "../models/post.model.js";
import Comment from "../models/comment.model.js";
import MemoryTopic from "../models/memoryTopic.model.js";
import { mistralEmbed } from "../services/mistral.service.js";
import { cosineSimilarity } from "../services/similarity.service.js";

export async function createGroup(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });

    let topicEmbedding = null;
    if (description) {
      topicEmbedding = await mistralEmbed(description);
    }

    const group = await Group.create({
      name: String(name).trim(),
      description: description || "",
      createdBy: userId,
      members: [userId],
      topicEmbedding,
    });

    return res.status(201).json({ group });
  } catch (err) {
    return next(err);
  }
}

export async function listGroups(req, res, next) {
  try {
    const groups = await Group.find().sort({ createdAt: -1 }).limit(50);
    return res.json({ groups });
  } catch (err) {
    return next(err);
  }
}

export async function getGroup(req, res, next) {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });
    return res.json({ group });
  } catch (err) {
    return next(err);
  }
}

export async function joinGroup(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (!group.members.find((m) => String(m) === String(userId))) {
      group.members.push(userId);
      await group.save();
    }

    return res.json({ group });
  } catch (err) {
    return next(err);
  }
}

export async function leaveGroup(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    group.members = group.members.filter((m) => String(m) !== String(userId));
    await group.save();

    return res.json({ group });
  } catch (err) {
    return next(err);
  }
}

export async function createPost(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;
    const { title, content } = req.body || {};
    if (!content) return res.status(400).json({ error: "content is required" });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const post = await Post.create({
      groupId,
      authorId: userId,
      title: title || "",
      content,
      likedBy: [],
    });

    return res.status(201).json({ post });
  } catch (err) {
    return next(err);
  }
}

export async function listPosts(req, res, next) {
  try {
    const { groupId } = req.params;
    const posts = await Post.find({ groupId }).sort({ createdAt: -1 }).limit(50);
    return res.json({ posts });
  } catch (err) {
    return next(err);
  }
}

export async function addComment(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId, postId } = req.params;
    const { content, parentCommentId } = req.body || {};
    if (!content) return res.status(400).json({ error: "content is required" });

    const post = await Post.findOne({ _id: postId, groupId });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = await Comment.create({
      groupId,
      postId,
      authorId: userId,
      content,
      parentCommentId: parentCommentId || null,
      likedBy: [],
    });

    return res.status(201).json({ comment });
  } catch (err) {
    return next(err);
  }
}

export async function listComments(req, res, next) {
  try {
    const { groupId, postId } = req.params;
    const comments = await Comment.find({ groupId, postId }).sort({ createdAt: 1 });
    return res.json({ comments });
  } catch (err) {
    return next(err);
  }
}

export async function togglePostLike(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId, postId } = req.params;

    const post = await Post.findOne({ _id: postId, groupId });
    if (!post) return res.status(404).json({ error: "Post not found" });

    const already = post.likedBy.find((u) => String(u) === String(userId));
    if (already) {
      post.likedBy = post.likedBy.filter((u) => String(u) !== String(userId));
    } else {
      post.likedBy.push(userId);
    }
    await post.save();

    return res.json({ post });
  } catch (err) {
    return next(err);
  }
}

export async function toggleCommentLike(req, res, next) {
  try {
    const userId = req.user.id;
    const { groupId, postId, commentId } = req.params;

    const comment = await Comment.findOne({ _id: commentId, groupId, postId });
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const already = comment.likedBy.find((u) => String(u) === String(userId));
    if (already) {
      comment.likedBy = comment.likedBy.filter((u) => String(u) !== String(userId));
    } else {
      comment.likedBy.push(userId);
    }
    await comment.save();

    return res.json({ comment });
  } catch (err) {
    return next(err);
  }
}

export async function recommendedGroups(req, res, next) {
  try {
    const userId = req.user.id;

    const memories = await MemoryTopic.find({ userId }).sort({ createdAt: -1 }).limit(20);
    const groups = await Group.find({ topicEmbedding: { $exists: true, $ne: null } }).limit(100);

    if (memories.length === 0 || groups.length === 0) {
      return res.json({ groups });
    }

    const results = groups
      .map((g) => {
        const scores = memories.map((m) => cosineSimilarity(m.embedding, g.topicEmbedding || []));
        const maxScore = scores.length ? Math.max(...scores) : 0;
        return { group: g, score: maxScore };
      })
      .sort((a, b) => b.score - a.score);

    return res.json({
      groups: results.map((r) => ({
        ...r.group.toObject(),
        similarity: r.score,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

