/// <reference types="@playwright/test" />
import { test, expect, type Route } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setSchoolAdminSession } from "./helpers/session";

type SchoolClass = {
  _id: string;
  name: string;
};

// UI functionality test for Manage Classes page with network interception
test.describe("Manage Classes UI (network mocked)", () => {
  test("create and delete a class updates the table", async ({ page }) => {
    await setSchoolAdminSession(page);

    const classes: SchoolClass[] = [];

    await page.route("**/api/classes**", async (route: Route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      if (!url.pathname.startsWith("/api/classes")) {
        await route.fallback();
        return;
      }

      if (method === "GET" && url.pathname === "/api/classes") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, classes }),
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/classes") {
        let post: { name?: string } = {};
        try {
          post = request.postDataJSON() as { name?: string };
        } catch {
          post = {};
        }
        const name =
          typeof post?.name === "string" && post.name.trim().length > 0
            ? post.name.trim()
            : "Grade 10";
        const createdClass = {
          _id: `cls_${classes.length + 1}`,
          name,
        };
        classes.push(createdClass);

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            class: createdClass,
            classId: createdClass._id,
          }),
        });
        return;
      }

      const isDeleteById =
        method === "DELETE" && /^\/api\/classes\/[^/]+$/.test(url.pathname);
      const isDeleteOnCollection =
        method === "DELETE" && url.pathname === "/api/classes";
      if (isDeleteById || isDeleteOnCollection) {
        const idFromPath = isDeleteById ? url.pathname.split("/").at(-1) : null;
        const id = idFromPath || url.searchParams.get("id");
        if (id) {
          const index = classes.findIndex((entry) => entry._id === id);
          if (index !== -1) {
            classes.splice(index, 1);
          }
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Unsupported test route" }),
      });
    });

    await navigateToAppRoute(page, "/workspace/manage/classes/create");

    // Create a class
    const className = "Grade 10";
    await page.getByLabel("Class Name").fill(className);
    await page.getByRole("button", { name: "Create Class" }).click();

    // New class appears in current list chips.
    await expect(page.getByText(className, { exact: true })).toBeVisible();

    await navigateToAppRoute(page, "/workspace/manage/classes");

    // Row appears on directory page.
    const row = page.getByRole("row", { name: new RegExp(className) });
    await expect(row).toBeVisible();

    // Archive the class from row action.
    await row.getByRole("button").first().click();
    // Confirm delete
    await page.getByRole("button", { name: "Archive" }).click();

    // Row removed
    await expect(
      page.getByRole("row", { name: new RegExp(className) }),
    ).toHaveCount(0);
  });
});
