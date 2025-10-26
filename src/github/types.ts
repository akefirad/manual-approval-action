export interface Issue {
  number: number;
  htmlUrl: string;
  state: "open" | "closed";
}

export interface Comment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  createdAt: string;
}
