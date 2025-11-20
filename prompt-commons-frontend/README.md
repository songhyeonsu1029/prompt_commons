Role

Act as a Senior Frontend React Developer.

Project Context

You are working on prompt-commons-frontend, a React + TailwindCSS + Vite project.
Currently, the ExperimentDetailPage.jsx displays a single, static version of a prompt experiment.
We need to implement a "Prompt Version Control" system to allow Authors to manage prompt iterations and Users to explore history.

Objective

Implement the frontend logic and UI for Prompt Version Control in ExperimentDetailPage.jsx and update the mock data in api.js.

Requirements & Steps

Step 1: Update Data Model (Mock Data)

Modify src/services/api.js:

Update MOCK_EXPERIMENTS_DB to support versioning.

Instead of a single prompt_text and stats, structure the data to have a versions array.

Each version object should contain:

version_number (e.g., "v1.0", "v1.2")

prompt_text (The content of that version)

changelog (String explanation of changes, e.g., "Optimized for GPT-4o")

tags (Specific tags for this version, e.g., ["fast", "stable"])

created_at (Date string)

stats (Object with reproduction_rate, reproduction_count, views specific to this version)

Ensure the main experiment object has a field active_version pointing to the latest one.

Step 2: State Management in Detail Page

Refactor src/pages/ExperimentDetailPage.jsx:

Add state selectedVersion to track which version is currently being viewed.

Initialize this state with the latest version when data is fetched.

Ensure that when selectedVersion changes, the displayed Prompt Text, Stats (Reliability Card), and Tags update dynamically to reflect that specific version's data.

Step 3: UI Implementation (Header & Selector)

Update the Header section of ExperimentDetailPage.jsx:

Version Selector: Add a dropdown menu (or <select> styled with Tailwind) next to the Title.

It should list all available versions (e.g., "v1.2 (Latest)", "v1.1", "v1.0").

Selecting an item updates the selectedVersion state.

Version Badge: Display the current version tag (e.g., v1.2) prominently next to the title.

Step 4: History Tab & Changelog

Add a new tab named "History" to the bottom section (alongside Comments/Reproduction).

In the History tab, render a Timeline View:

List versions in reverse chronological order.

For each version, display:

Version Number & Date

Changelog message (The "Why" it changed).

A "View This Version" button that sets the selectedVersion state.

Step 5: "Draft New Version" Feature (Author Only)

Add a "Draft New Version" button in the Action Buttons area (only visible if the user is the author - assume true for now or mock it).

Clicking this button should open a Modal (create a simple Modal component inside the page or separate file).

Modal Form Fields:

Source Version: (Read-only, shows current version).

New Prompt Text: (Textarea, pre-filled with current version's text).

Version Tag: (Input, e.g., "v1.3").

Changelog: (Textarea, "What changed?").

Action: Clicking "Publish" should update the local state (mock update) and switch the view to the new version.

Constraints

Use existing UI components (Button, Badge, Card) from src/components.

Use lucide-react for icons (e.g., History, GitCommit, ChevronDown).

Keep the styling consistent with the current clean, blue/gray Tailwind theme.

Ensure ReliabilityCard component handles specific version stats correctly.

Output

Please provide the updated code for:

src/services/api.js

src/pages/ExperimentDetailPage.jsx