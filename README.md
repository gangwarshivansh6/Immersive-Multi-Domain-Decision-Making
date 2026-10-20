# Immersive Multi-Domain Decision Making

An interactive, scenario-based decision-training platform for practicing decisions across connected operational domains. Trainees review incoming reports, manage tasks, respond to changing conditions, and receive an after-action performance review. Instructor tools support scenario oversight and training review.

> **SIH project note:** This repository currently includes a mock training scenario and application logic. Describe the project as a simulation/prototype unless you have independently verified every integration and deployed feature.

## Key Features

- **Interactive trainee workspace** to review reports and make scenario decisions.
- **Multi-domain scenario view** for land, air, and other connected operational information represented in the scenario.
- **Decision restriction checks** that flag actions conflicting with configured safety or scenario rules.
- **Instructor dashboard** and split-view workflow for authorized training roles.
- **After-action review** with performance evaluation.
- **Authentication and role-aware access** using Firebase Authentication and Firestore.
- **Offline queue support** intended to retain selected actions while offline and sync when connectivity returns.
- **AI-assisted functionality** through the Google Gemini API where configured.

## Tech Stack

- React 19, TypeScript, Vite
- Express and `tsx` for the local API server
- Firebase Authentication and Cloud Firestore
- Google Gemini API (`@google/genai`)
- Tailwind CSS and Lucide icons

## Run Locally

### Prerequisites

- Node.js (use a current LTS release)
- npm
- Firebase project configuration
- Gemini API key for features that call Gemini

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root (or use `.env.local`, if that is how your environment is configured) and set:

```env
GEMINI_API_KEY=your_gemini_api_key
APP_URL=http://localhost:3000
```

Do not commit real secrets. `.env*` files are ignored by Git, except `.env.example`.

### 3. Configure Firebase

The application imports `firebase-applet-config.json` from the project root. Ensure this file contains the configuration for **your own** Firebase project and that Authentication, Firestore, and the required security rules are configured before testing. Do not assume the included configuration is suitable for a public submission.

### 4. Start the app

```bash
npm run dev
```

The Express server is configured to run on port `3000`. Open the local URL printed by the server or visit `http://localhost:3000`.

### 5. Create a production build

```bash
npm run build
```

To run the TypeScript check separately:

```bash
npm run lint
```

## Project Structure

```text
.
├── src/
│   ├── components/       # Trainee, instructor, map, reports, and review UI
│   ├── context/          # Authentication context
│   ├── data/             # Example scenario and initial data
│   ├── services/         # Firebase integration
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Restrictions, evaluation, speech, offline queue
├── server.ts             # Express API and simulation session endpoints
├── firebase-blueprint.json
├── firestore.rules
├── package.json
└── vite.config.ts
```

## Validation Before SIH Submission

- Run `npm install`, `npm run lint`, and `npm run build` locally.
- Test sign-in, trainee and instructor access, scenario decisions, offline/online behavior, and after-action review.
- Confirm Firebase rules are deployed and prevent unauthorized access.
- Replace any development-only or hard-coded administrator identity with a secure role-management approach before public deployment.
- Add screenshots/demo video and document which features are implemented versus planned.

## Limitations

The default scenario data is sample/mock data. Results from a simulation are for training and demonstration, not real-world operational guidance. AI-generated outputs, if enabled, should be reviewed by a responsible human.

## License

The source files include Apache-2.0 license headers where indicated. Confirm the licensing status of all dependencies and project assets before distributing the complete repository.
