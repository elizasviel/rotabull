import fetch from "node-fetch";

//The expected response from the readme api
interface Category {
  title: string;
  slug: string;
  order: number;
  reference: boolean;
  _id: string;
  isAPI: boolean;
  project: string;
  version: string;
  createdAt: string;
  __v: number;
  type: string;
  id: string;
}

const README_API_TOKEN = process.env.README_API_TOKEN;
const BASE_URL = "https://dash.readme.com/api/v1";

async function fetchPages() {
  try {
    const response = await fetch(`${BASE_URL}/categories`, {
      headers: {
        Authorization: `Basic ${Buffer.from(README_API_TOKEN + ":").toString(
          "base64"
        )}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const categories: Category[] = await response.json();
    const allPages = [];

    for (const category of categories) {
      const docsResponse = await fetch(
        `${BASE_URL}/categories/${category.slug}/docs`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              README_API_TOKEN + ":"
            ).toString("base64")}`,
            Accept: "application/json",
          },
        }
      );
      const docs = await docsResponse.json();

      for (const doc of docs) {
        const pageResponse = await fetch(`${BASE_URL}/docs/${doc.slug}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(
              README_API_TOKEN + ":"
            ).toString("base64")}`,
            Accept: "application/json",
          },
        });
        const page = await pageResponse.json();
        allPages.push({ slug: doc.slug, body: page.body });
      }
    }

    return allPages;
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

export async function prepareDataForClaude() {
  const pages = await fetchPages();
  const formattedData = pages
    .map((page) => `Document: ${page.slug}\n\nContent:\n${page.body}`)
    .join("\n\n---\n\n");
  return formattedData;
}
