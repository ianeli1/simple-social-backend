/*
ideas: 
- make a function that delivers the entire feed in one go
- posting directly
- handle the registration process here
- make a function that delivers all ref and users in one go
- handle friend requests
- should the server store repeated copies of the same post to improve performance/speed?
- use collections !

*/

export interface Feed {
  [key: string]: Post;
}

export interface NewPost {
  content: string;
  liked: boolean;
  ref?: string; //the ref id
  image?: string; //the image url
}

export interface Post extends Omit<NewPost, "liked"> {
  userId: string;
  timestamp: Date;
  likes: string[];
}

export interface User {
  userId: string;
  name: string;
  desc: string;
  icon: string | null;
}

export interface Profile {
  userId: string; //super cool encryption method, ik
  icon: string;
  name: string;
  desc: string;
  posts: string[];
  feed: string[];
  friends: string[];
}

export type ReduxPacket = {
  profile?: Profile;
  users: {
    [key: string]: User;
  };
  posts: Feed;
};

export type DataPacket = ReduxPacket | { error: string };
