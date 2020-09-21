import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as r from "./reference";
admin.initializeApp();
const usersDb = admin.firestore().collection("users");
const postsDb = admin.firestore().collection("globalPosts");

async function asyncForEach<Type>(
  array: Array<Type>,
  callback: (element: Type, index: number, array: Array<Type>) => Promise<any>
): Promise<void> {
  for (let index = 0, j = array.length; index < j; index++) {
    await callback(array[index], index, array);
  }
  return;
}

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//

/**
 * Whenever a user submits a new post, it gets posted in globalPosts/.
 * This function will append the postId to the poster's post list and
 * it will also append the post id to each of the poster's friends' feed
 */

async function updateFeeds(post: r.Post, postId: string): Promise<void> {
  try {
    const posterId = post.userId;
    const posterRef = usersDb.doc(posterId);
    void posterRef.update({
      posts: admin.firestore.FieldValue.arrayUnion(postId),
    }); //returns a promise, but I don't really care about the order of execution
    const poster = (await posterRef.get()).data() as r.Profile;
    poster.friends &&
      poster.friends.length &&
      asyncForEach(poster.friends, async (userId) => {
        const userRef = usersDb.doc(userId);
        await userRef.update({
          feed: admin.firestore.FieldValue.arrayUnion(postId),
        });
      });
  } catch (e) {
    console.log("An error ocurred while updating feeds", { e, post, postId });
  }
}

/*
export const updateFeedsAuto = functions.firestore
  .document("globalPosts/{postId}")
  .onCreate((snap, context) => {
    updateFeeds(snap.data() as r.Post, snap.id)
  });*/

/**
 * @param
 * aaaaaaaaaaaaaaaaaaaaaaaaaa
 *
 * @returns
 * A profile object
 */
export const createUser = functions.https.onCall(
  async (
    data: Omit<r.User, "userId"> & { email: string; password: string },
    context
  ) => {
    const user = await admin.auth().createUser({
      displayName: data.name,
      email: data.email,
      password: data.password,
      photoURL: data.icon,
      disabled: false,
    });
    const profile = {
      userId: user.uid, //super cool encryption method, ik
      icon: data.icon,
      name: data.name,
      desc: data.desc,
      posts: [],
      feed: [],
      friends: [],
    };
    await usersDb.doc(user.uid).set(profile);
    return profile;
  }
);

/**
 * Used for getting the profile info of a certain user
 * @param userId The user's id
 * @returns A data packet type containing either all the necessary info (user, posts, users objects) or an object describing an error
 *
 * @todo Add support for referenced posts
 * @todo Set limits
 */
export const getProfile = functions.https.onCall(
  async (data: { userId: string }, context): Promise<r.DataPacket> => {
    const result: r.DataPacket = {
      users: {},
      posts: {},
    };
    if (context.auth && data.userId) {
      const doc = await usersDb.doc(data.userId).get();
      if (doc.exists) {
        const profile = doc.data() as r.Profile;
        result.profile = profile;
        if (profile.friends && profile.friends.length) {
          void (await asyncForEach(profile.friends, async (userId) => {
            result.users[userId] = (
              await usersDb.doc(userId).get()
            ).data() as r.User;
          }));
        }

        if (profile.posts && profile.posts.length) {
          void (await asyncForEach(profile.posts, async (postId) => {
            result.posts[postId] = (
              await postsDb.doc(postId).get()
            ).data() as r.Post;
          }));
        }
        return result;
      } else {
        return { error: "This profile doesn't exist" };
      }
    } else {
      return {
        error: data.userId
          ? "This user is not logged in"
          : "Wrong parameter: userId",
      };
    }
  }
);

/**
 * Used to get the current user's feed
 *
 * @returns
 * A data packet containing all required info (posts, users) or an object describing an error
 *
 * @todo Add a limit to the amount of queried posts
 */
export const getFeed = functions.https.onCall(
  async (data: {}, context): Promise<r.DataPacket> => {
    const result: r.DataPacket = {
      users: {},
      posts: {},
    };
    if (context.auth) {
      const doc = await usersDb.doc(context.auth.uid).get();
      if (doc.exists) {
        const profile = doc.data() as r.Profile;
        profile.feed &&
          profile.feed.length &&
          (await asyncForEach(profile.feed, async (postId) => {
            result.posts[postId] = (
              await postsDb.doc(postId).get()
            ).data() as r.Post;
            const id = result.posts[postId].userId;
            if (id) {
              result.users[id] = (await usersDb.doc(id).get()).data() as r.User;
            }
          }));
        return result;
      } else {
        return { error: "The current user doesn't exist" };
      }
    } else {
      return { error: "This user is not logged in" };
    }
  }
);

export const addPost = functions.https.onCall(
  async (data: r.NewPost, context) => {
    if (context.auth) {
      //if it's logged in
      try {
        const timestamp = new Date();
        const post: r.Post = {
          userId: context.auth.uid,
          content: data.content,
          timestamp,
          likes: data.liked || false ? [context.auth.uid] : [],
          ref: data.ref || undefined,
          image: data.image || undefined,
        };
        const id = String(timestamp);
        await postsDb.doc(id).set(post);
        await updateFeeds(post, id);
      } catch (e) {
        console.log("An error ocurred while creating this post", e, data);
      }
    }
  }
);

export const addFriendReq = functions.https.onCall(
  async (data: { userId: string }, context) => {
    if (context.auth && data.userId) {
      await usersDb.doc(data.userId).update({
        friendReq: admin.firestore.FieldValue.arrayUnion(context.auth.uid),
      });
    }
  }
);

export const acceptFriendReq = functions.https.onCall(
  async (data: { userId: string }, context) => {
    if (context.auth && data.userId) {
      await usersDb.doc(context.auth.uid).update({
        friendReq: admin.firestore.FieldValue.arrayRemove(data.userId),
        friends: admin.firestore.FieldValue.arrayUnion(data.userId),
      });
      await usersDb.doc(data.userId).update({
        friends: admin.firestore.FieldValue.arrayUnion(context.auth.uid),
      });
    }
  }
);
