import fetch from "node-fetch";
import { PrismaClient } from "@prisma/client";
import forge from "./forge/client";

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

const prisma = new PrismaClient();

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
  //Delete the old collection in Forge and postgres db
  await forge.$collections.delete("readme1", { deleteDocuments: true });
  await prisma.forgeDocsCollection.deleteMany();

  //create a new collection in Forge
  const collection = await forge.$collections.create({
    name: "readme1",
  });

  //Fetch the pages from the readme api
  const pages = await fetchPages();

  //Create documents in Forge
  try {
    for (const page of pages) {
      console.log("CREATING DOCUMENT IN FORGE", page.slug);
      await forge.$documents.create({
        name: page.slug,
        text:
          "https://support.rotabull.com/docs/" + page.slug + "\n\n" + page.body,
        collectionIds: [collection.id],
      });
    }
  } catch (error) {
    console.error("Error creating documents in Forge:", error);
  }

  //Store collection id and name in postgres
  await prisma.forgeDocsCollection.create({
    data: {
      lastUpdated: new Date().toISOString(),
      forgeId: collection.id,
      name: collection.name,
    },
  });

  try {
    // Use a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Clear existing SupportDoc entries
      await tx.supportDoc.deleteMany();

      // Insert new SupportDoc entries
      for (const page of pages) {
        await tx.supportDoc.create({
          data: {
            lastUpdated: new Date().toISOString(),
            slug: page.slug,
            body: page.body,
          },
        });
      }
    });

    console.log(`Readme data has been written to the database`);
  } catch (error) {
    console.error("Error writing readme data to database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fetchReadme();
