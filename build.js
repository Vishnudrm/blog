const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const matter = require("gray-matter");

const ROOT = __dirname;
const SITE_URL = "https://www.vishnuprajagopal.com";
const BUILD_DIR = path.join(ROOT, "build");
const PUBLIC_DIR = path.join(ROOT, "public");
const TEMPLATES_DIR = path.join(ROOT, "templates");
const CONTENT_DIR = path.join(ROOT, "content");

const templates = {
  layout: fs.readFileSync(path.join(TEMPLATES_DIR, "layout.html"), "utf8"),
  home: fs.readFileSync(path.join(TEMPLATES_DIR, "home.html"), "utf8"),
  blog: fs.readFileSync(path.join(TEMPLATES_DIR, "blog.html"), "utf8"),
  post: fs.readFileSync(path.join(TEMPLATES_DIR, "post.html"), "utf8"),
  learnings: fs.readFileSync(path.join(TEMPLATES_DIR, "learnings.html"), "utf8"),
  writings: fs.readFileSync(path.join(TEMPLATES_DIR, "writings.html"), "utf8"),
  builds: fs.readFileSync(path.join(TEMPLATES_DIR, "builds.html"), "utf8"),
  about: fs.readFileSync(path.join(TEMPLATES_DIR, "about.html"), "utf8")
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeDir(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return;
  ensureDir(destination);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplate(template, data = {}) {
  let output = template;
  for (const [key, value] of Object.entries(data)) {
    output = output.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), String(value ?? ""));
  }
  return output;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

function formatDate(dateString) {
  return parseDate(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function readingTimeFromContent(content) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function personSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Vishnu P Rajagopal",
    url: SITE_URL,
    sameAs: [
      "https://github.com/Vishnudrm",
      "https://linkedin.com/in/vishnu-p-rajagopal-585b8b216"
    ],
    jobTitle: "Data Engineer",
    alumniOf: "CUSAT"
  };
}

function buildBreadcrumbs(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function buildFaqSchema(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

function buildArticleSchema(post, canonicalUrl) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    author: {
      "@type": "Person",
      name: "Vishnu P Rajagopal",
      url: SITE_URL
    },
    publisher: {
      "@type": "Organization",
      name: "Vishnu P Rajagopal",
      url: SITE_URL
    },
    mainEntityOfPage: canonicalUrl,
    datePublished: post.date,
    dateModified: post.date,
    articleSection: post.section,
    keywords: post.tags.join(", ")
  };
}

const SECTION_DIRS = {
  builds: ["builds"],
  learnings: ["learnings", "field-notes"],
  letters: ["letters", "writings"]
};

function getContentFiles() {
  const files = [];

  for (const sectionDirs of Object.values(SECTION_DIRS)) {
    for (const section of sectionDirs) {
      const sectionPath = path.join(CONTENT_DIR, section);
      if (!fs.existsSync(sectionPath)) continue;

      for (const entry of fs.readdirSync(sectionPath, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(path.join(sectionPath, entry.name));
        }
      }
    }
  }

  return files;
}

function normalizeSection(section) {
  const normalized = String(section || "learnings").trim().toLowerCase();

  if (["build", "builds", "projects"].includes(normalized)) return "builds";
  if (["learn", "learning", "field-notes", "field_notes", "fieldnotes", "learnings"].includes(normalized)) return "learnings";
  if (["letter", "letters", "writing", "writings"].includes(normalized)) return "letters";

  return normalized || "learnings";
}

function collectPosts() {
  const posts = getContentFiles().map((filePath) => {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    const content = parsed.content || "";
    const bodyHtml = marked.parse(content);
    const fileSlug = slugify(path.basename(filePath, ".md"));
    const explicitSlug = parsed.data.slug ? slugify(String(parsed.data.slug)) : "";
    const slug = explicitSlug || fileSlug || slugify(parsed.data.title || "untitled");
    const inferredSection = path.basename(path.dirname(filePath));

    return {
      slug,
      filePath,
      section: normalizeSection(parsed.data.section || inferredSection),
      title: parsed.data.title || "Untitled",
      description: parsed.data.description || "",
      date: parsed.data.date || new Date().toISOString().slice(0, 10),
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
      category: parsed.data.category || "General",
      readingTime: parsed.data.readingTime === true ? readingTimeFromContent(content) : 1,
      draft: Boolean(parsed.data.draft),
      html: bodyHtml,
      content
    };
  }).filter((post) => !post.draft);

  posts.sort((a, b) => parseDate(b.date) - parseDate(a.date));
  return posts;
}

function buildIndexList(posts, section) {
  return posts
    .filter((post) => post.section === section)
    .map((post) => `
      <li class="post-item reveal">
        <article>
          <div class="post-meta">
            <span>${escapeHtml(post.category)}</span>
            <span>${formatDate(post.date)}</span>
            <span>${post.readingTime} min read</span>
          </div>
          <a href="/blog/${escapeHtml(post.slug)}" class="post-title-link">${escapeHtml(post.title)}</a>
          <p>${escapeHtml(post.description)}</p>
        </article>
      </li>
    `)
    .join("");
}

function buildHomePage(posts) {
  const latest = posts.slice(0, 3);
  const homeContent = renderTemplate(templates.home, {
    latestPosts: latest.map((post) => `
      <li class="post-item reveal">
        <article>
          <div class="post-meta">
            <span>${escapeHtml(post.category)}</span>
            <span>${escapeHtml(post.section === "learnings" ? "Ledger" : post.section === "letters" ? "Epiphanies" : "Blueprint")}</span>
            <span>${formatDate(post.date)}</span>
          </div>
          <a href="/blog/${escapeHtml(post.slug)}" class="post-title-link">${escapeHtml(post.title)}</a>
          <p>${escapeHtml(post.description)}</p>
        </article>
      </li>
    `).join(""),
    learningsCount: posts.filter((post) => post.section === "learnings").length,
    lettersCount: posts.filter((post) => post.section === "letters").length
  });

  return wrapPage({
    title: "Home",
    description: "A personal overview of systems thinking and writing.",
    bodyClass: "home-page",
    canonicalUrl: `${SITE_URL}/`,
    content: homeContent,
    breadcrumbs: buildBreadcrumbs([{ name: "Home", url: `${SITE_URL}/` }]),
    pageType: "WebSite",
    jsonLd: JSON.stringify([personSchema()], null, 2),
    sectionKey: "home"
  });
}

function buildBlogPage() {
  const content = templates.blog;

  return wrapPage({
    title: "Blog",
    description: "Explore the blog by section: practical notes, essays, and reflections.",
    bodyClass: "blog-page",
    canonicalUrl: `${SITE_URL}/blog`,
    content,
    breadcrumbs: buildBreadcrumbs([
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Blog", url: `${SITE_URL}/blog` }
    ]),
    pageType: "CollectionPage",
    jsonLd: JSON.stringify([personSchema()], null, 2),
    sectionKey: "home"
  });
}

function buildIndexPage({ title, description, section, templateName, canonicalUrl, pageContent, bodyClass }) {
  const content = renderTemplate(templates[templateName], {
    pageHeading: title,
    introText: description,
    list: pageContent,
    accentClass: section
  });

  return wrapPage({
    title,
    description,
    bodyClass,
    canonicalUrl,
    content,
    breadcrumbs: buildBreadcrumbs([
      { name: "Home", url: `${SITE_URL}/` },
      { name: title, url: canonicalUrl }
    ]),
    pageType: "CollectionPage",
    jsonLd: JSON.stringify([personSchema()], null, 2),
    sectionKey: section
  });
}

function buildBuildsPage(posts = []) {
  const buildPosts = posts.filter((post) => post.section === "builds");
  const pageContent = buildIndexList(posts, "builds");

  const content = renderTemplate(templates.builds, {
    pageHeading: "Blueprints",
    introText: "Small systems, experiments, and prototypes worth keeping in view.",
    list: pageContent
  });

  return wrapPage({
    title: "Blueprints",
    description: "Blueprint notes, experiments, and small systems in progress.",
    bodyClass: "builds-page",
    canonicalUrl: `${SITE_URL}/projects`,
    content,
    breadcrumbs: buildBreadcrumbs([
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Blueprints", url: `${SITE_URL}/projects` }
    ]),
    pageType: "CollectionPage",
    jsonLd: JSON.stringify([personSchema()], null, 2),
    sectionKey: "builds"
  });
}

function buildAboutPage(posts = []) {
  const recentPosts = posts.slice(0, 3).map((post) => `
      <li class="post-item reveal">
        <article>
          <div class="post-meta">
            <span>${escapeHtml(post.category)}</span>
            <span>${escapeHtml(post.section === "learnings" ? "Ledger" : post.section === "letters" ? "Epiphanies" : "Blueprint")}</span>
            <span>${formatDate(post.date)}</span>
          </div>
          <a href="/blog/${escapeHtml(post.slug)}" class="post-title-link">${escapeHtml(post.title)}</a>
          <p>${escapeHtml(post.description)}</p>
        </article>
      </li>
    `).join("");

  const content = renderTemplate(templates.about, {
    recentPosts,
    faqJson: buildFaqSchema([
      {
        question: "What is your current focus?",
        answer: "I am focused on data engineering, systems design, AI workflows, and writing clearly about how software is built and reasoned about."
      },
      {
        question: "Where are you studying?",
        answer: "I am a final-year B.Tech Computer Science and Engineering student at CUSAT, Kochi."
      },
      {
        question: "What do you value in engineering?",
        answer: "I care about clarity, reliability, thoughtful trade-offs, and systems that people can understand and maintain over time."
      }
    ])
  });

  return wrapPage({
    title: "On Being Me",
    description: "Contradictions held together by deadlines, solitude, and a quiet room that asks nothing of you.",
    bodyClass: "about-page",
    canonicalUrl: `${SITE_URL}/about`,
    content,
    breadcrumbs: buildBreadcrumbs([
      { name: "Home", url: `${SITE_URL}/` },
      { name: "On Being Me", url: `${SITE_URL}/about` }
    ]),
    pageType: "AboutPage",
    jsonLd: JSON.stringify([
      personSchema(),
      buildFaqSchema([
        {
          question: "What is your current focus?",
          answer: "I am focused on data engineering, systems design, AI workflows, and writing clearly about how software is built and reasoned about."
        },
        {
          question: "Where are you studying?",
          answer: "I am a final-year B.Tech Computer Science and Engineering student at CUSAT, Kochi."
        },
        {
          question: "What do you value in engineering?",
          answer: "I care about clarity, reliability, thoughtful trade-offs, and systems that people can understand and maintain over time."
        }
      ])
    ], null, 2),
    sectionKey: "about"
  });
}

function buildPostPage(post) {
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
  const sectionConfig = post.section === "letters"
    ? { label: "Epiphanies", breadcrumb: "Epiphanies", sectionPath: "/blog/letters", bodyClass: "letters-post" }
    : post.section === "builds"
      ? { label: "Blueprint", breadcrumb: "Blueprint", sectionPath: "/projects", bodyClass: "builds-post" }
      : { label: "Ledger", breadcrumb: "Ledger", sectionPath: "/blog/learnings", bodyClass: "learnings-post" };

  const content = renderTemplate(templates.post, {
    postTitle: escapeHtml(post.title),
    postDate: formatDate(post.date),
    readingTime: `${post.readingTime} min read`,
    category: escapeHtml(post.category),
    tags: post.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join(""),
    articleBody: post.html,
    markdownSource: "post.md",
    sectionLabel: escapeHtml(sectionConfig.label)
  });

  return wrapPage({
    title: post.title,
    description: post.description,
    bodyClass: `post-page ${sectionConfig.bodyClass}`,
    canonicalUrl,
    content,
    breadcrumbs: buildBreadcrumbs([
      { name: "Home", url: `${SITE_URL}/` },
      { name: sectionConfig.breadcrumb, url: `${SITE_URL}${sectionConfig.sectionPath}` },
      { name: post.title, url: canonicalUrl }
    ]),
    pageType: "Article",
    jsonLd: JSON.stringify([
      personSchema(),
      buildArticleSchema(post, canonicalUrl),
      buildBreadcrumbs([
        { name: "Home", url: `${SITE_URL}/` },
        { name: sectionConfig.breadcrumb, url: `${SITE_URL}${sectionConfig.sectionPath}` },
        { name: post.title, url: canonicalUrl }
      ])
    ], null, 2),
    sectionKey: post.section
  });
}

function wrapPage({ title, description, canonicalUrl, content, bodyClass, breadcrumbs, pageType, jsonLd, sectionKey = "home" }) {
  const layout = templates.layout;

  return renderTemplate(layout, {
    pageTitle: escapeHtml(title),
    metaDescription: escapeHtml(description),
    canonicalUrl: escapeHtml(canonicalUrl),
    bodyClass: bodyClass || "default-page",
    pageContent: content,
    breadcrumbsJsonLd: breadcrumbs || "",
    personSchema: JSON.stringify(personSchema(), null, 2),
    pageType,
    pageJsonLd: jsonLd || JSON.stringify([personSchema()], null, 2),
    currentYear: new Date().getFullYear(),
    sectionKey
  });
}

function generateSitemap(pageUrls) {
  const urlsXml = pageUrls
    .map((url) => `  <url>\n    <loc>${escapeHtml(url)}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

function pruneStaleGeneratedBlogRoutes(posts) {
  const blogDir = path.join(BUILD_DIR, "blog");
  if (!fs.existsSync(blogDir)) return;

  const validNames = new Set([
    "learnings",
    "letters",
    ...posts.map((post) => post.slug)
  ]);

  for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!validNames.has(entry.name)) {
      fs.rmSync(path.join(blogDir, entry.name), { recursive: true, force: true });
    }
  }
}

function buildSite() {
  removeDir(BUILD_DIR);
  ensureDir(BUILD_DIR);
  copyDirectory(PUBLIC_DIR, BUILD_DIR);

  const posts = collectPosts();
  const sections = {
    learnings: posts.filter((post) => post.section === "learnings"),
    letters: posts.filter((post) => post.section === "letters")
  };

  const generatedPages = [];

  const homeHtml = buildBlogPage();
  const homePath = path.join(BUILD_DIR, "index.html");
  fs.writeFileSync(homePath, homeHtml, "utf8");
  generatedPages.push(`${SITE_URL}/`);

  const blogPath = path.join(BUILD_DIR, "blog", "index.html");
  ensureDir(path.dirname(blogPath));
  const blogHtml = buildBlogPage();
  fs.writeFileSync(blogPath, blogHtml, "utf8");
  generatedPages.push(`${SITE_URL}/blog`);

  const learningsPath = path.join(BUILD_DIR, "blog", "learnings", "index.html");
  ensureDir(path.dirname(learningsPath));
  const learningsHtml = buildIndexPage({
    title: "Ledger",
    description: "Notes on data engineering, systems, and the practical craft of building reliable software.",
    section: "learnings",
    templateName: "learnings",
    canonicalUrl: `${SITE_URL}/blog/learnings`,
    pageContent: buildIndexList(posts, "learnings"),
    bodyClass: "learnings-page"
  });
  fs.writeFileSync(learningsPath, learningsHtml, "utf8");
  generatedPages.push(`${SITE_URL}/blog/learnings`);

  const lettersPath = path.join(BUILD_DIR, "blog", "letters", "index.html");
  ensureDir(path.dirname(lettersPath));
  const lettersHtml = buildIndexPage({
    title: "Epiphanies",
    description: "A collection of essays and reflections on learning, attention, and the shape of a thoughtful life.",
    section: "letters",
    templateName: "writings",
    canonicalUrl: `${SITE_URL}/blog/letters`,
    pageContent: buildIndexList(posts, "letters"),
    bodyClass: "letters-page"
  });
  fs.writeFileSync(lettersPath, lettersHtml, "utf8");
  generatedPages.push(`${SITE_URL}/blog/letters`);

  const projectsPath = path.join(BUILD_DIR, "projects", "index.html");
  ensureDir(path.dirname(projectsPath));
  const projectsHtml = buildBuildsPage(posts);
  fs.writeFileSync(projectsPath, projectsHtml, "utf8");
  generatedPages.push(`${SITE_URL}/projects`);

  const aboutPath = path.join(BUILD_DIR, "about", "index.html");
  ensureDir(path.dirname(aboutPath));
  const aboutHtml = buildAboutPage(posts);
  fs.writeFileSync(aboutPath, aboutHtml, "utf8");
  generatedPages.push(`${SITE_URL}/about`);

  for (const post of posts) {
    const postDir = path.join(BUILD_DIR, "blog", post.slug);
    ensureDir(postDir);
    const postOut = path.join(postDir, "index.html");
    const postMarkdownPath = path.join(postDir, "post.md");
    const html = buildPostPage(post);
    fs.writeFileSync(postOut, html, "utf8");
    fs.writeFileSync(postMarkdownPath, post.content, "utf8");
    generatedPages.push(`${SITE_URL}/blog/${post.slug}`);
  }

  pruneStaleGeneratedBlogRoutes(posts);

  fs.writeFileSync(path.join(BUILD_DIR, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, "utf8");
  fs.writeFileSync(path.join(BUILD_DIR, "sitemap.xml"), generateSitemap(generatedPages), "utf8");

  console.log(`Built ${posts.length} posts to ${BUILD_DIR}`);
}

if (require.main === module) {
  const watchMode = process.argv.includes("--watch");
  buildSite();

  if (watchMode) {
    const watchPaths = [path.join(ROOT, "content"), path.join(ROOT, "templates"), path.join(ROOT, "public")];

    for (const watchedPath of watchPaths) {
      fs.watch(watchedPath, { recursive: true }, (eventType, filename) => {
        if (filename) {
          console.log(`Change detected in ${filename}. Rebuilding...`);
          buildSite();
        }
      });
    }

    console.log("Watching for changes...");
  }
}
