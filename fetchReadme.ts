import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

// Includes Guides from v1.1

// The expected response from the readme api
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
  let allPages: { slug: string; body: string }[] = [];
  try {
    // fetch all categories
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
    console.log("FETCHED CATEGORIES", categories);

    // fetch all docs for each category
    for (const category of categories) {
      await fetchCategoryDocs(category.slug, allPages);
    }
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
  return allPages;
}

async function fetchCategoryDocs(
  categorySlug: string,
  allPages: { slug: string; body: string }[]
) {
  const docsResponse = await fetch(
    `${BASE_URL}/categories/${categorySlug}/docs`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(README_API_TOKEN + ":").toString(
          "base64"
        )}`,
        Accept: "application/json",
      },
    }
  );
  const docs = await docsResponse.json();
  console.log(`ALL DOCS IN ${categorySlug} CATEGORY`, docs);

  // fetch content for each doc
  for (const doc of docs) {
    await fetchDocContent(doc, allPages);
  }
}

async function fetchDocContent(
  doc: any,
  allPages: { slug: string; body: string }[]
) {
  const pageResponse = await fetch(`${BASE_URL}/docs/${doc.slug}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(README_API_TOKEN + ":").toString(
        "base64"
      )}`,
      Accept: "application/json",
    },
  });
  const page = await pageResponse.json();
  allPages.push({ slug: doc.slug, body: page.body });

  // Recursively fetch children
  if (doc.children && doc.children.length > 0) {
    for (const child of doc.children) {
      await fetchDocContent(child, allPages);
    }
  }
}

export async function fetchReadme() {
  const pages = await fetchPages();

  const fileName = "supportDocs.json";
  const filePath = path.join(process.cwd(), fileName);

  try {
    await fs.writeFile(filePath, JSON.stringify(pages, null, 2), "utf-8");
    console.log(`Readme data has been written to ${filePath}`);
  } catch (error) {
    console.error("Error writing readme data to file:", error);
  }
}
