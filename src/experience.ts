export type SceneId = "estate" | "winery" | "cellar" | "company";
export type Destination = SceneId | "management";
export type ManagementSection = "finance" | "market" | "equipment" | "people";

export type IconName =
  | "estate"
  | "winery"
  | "cellar"
  | "company"
  | "management"
  | "calendar"
  | "activity"
  | "arrow"
  | "close"
  | "vine"
  | "building"
  | "grounds"
  | "vessel"
  | "work"
  | "barrel"
  | "bottle"
  | "shelves"
  | "landmark"
  | "spark"
  | "finance"
  | "market"
  | "equipment"
  | "people";

export type SceneObjectId =
  | "estate-parcel"
  | "estate-building"
  | "estate-grounds"
  | "winery-vessel"
  | "winery-work"
  | "winery-barrel"
  | "cellar-barrels"
  | "cellar-shelves"
  | "cellar-wine"
  | "company-portfolio"
  | "company-landmark"
  | "company-milestones";

export interface SceneObject {
  id: SceneObjectId;
  label: string;
  icon: IconName;
  category: string;
  description: string;
  detail: string;
  fields: string[];
}

export interface SceneDefinition {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  sceneCaption: string;
  objects: SceneObject[];
}

export const scenes: Record<SceneId, SceneDefinition> = {
  estate: {
    label: "Estate",
    eyebrow: "YOUR PLACE",
    title: "The estate",
    description: "A place to grow, make, and shape something of your own.",
    sceneCaption: "A view across the estate",
    objects: [
      {
        id: "estate-parcel",
        label: "Vineyard parcel",
        icon: "vine",
        category: "THE VINEYARD",
        description: "Every wine begins with a place.",
        detail: "Explore the parcel's identity and the conditions that shape its harvest.",
        fields: ["Origin & site", "Raw material potential", "Harvest context"],
      },
      {
        id: "estate-building",
        label: "Winery building",
        icon: "building",
        category: "THE ESTATE",
        description: "A home for the work of making wine.",
        detail: "The winery connects the vineyard with the spaces where wine develops.",
        fields: ["Building", "Production spaces", "Connections"],
      },
      {
        id: "estate-grounds",
        label: "Estate grounds",
        icon: "grounds",
        category: "THE ESTATE",
        description: "The paths and spaces between places.",
        detail: "The estate brings its vineyard, winery, and cellar together.",
        fields: ["Landscape", "Places", "Connections"],
      },
    ],
  },
  winery: {
    label: "Winery",
    eyebrow: "THE CRAFT",
    title: "The winery",
    description: "A closer look at the spaces where the harvest becomes wine.",
    sceneCaption: "Inside the production room",
    objects: [
      {
        id: "winery-vessel",
        label: "Production vessel",
        icon: "vessel",
        category: "PRODUCTION",
        description: "A vessel for the work of transformation.",
        detail: "Production details and the wine's development will have a place here.",
        fields: ["Vessel", "Current contents", "Development"],
      },
      {
        id: "winery-work",
        label: "Work area",
        icon: "work",
        category: "PRODUCTION",
        description: "A space for the people and work of the winery.",
        detail: "This area can bring together the work connected to production.",
        fields: ["Work area", "Activities", "People"],
      },
      {
        id: "winery-barrel",
        label: "Barrel storage",
        icon: "barrel",
        category: "PRODUCTION",
        description: "A place for vessels between the winery and cellar.",
        detail: "Vessel and storage information will be presented together here.",
        fields: ["Vessels", "Storage", "Connections"],
      },
    ],
  },
  cellar: {
    label: "Cellar",
    eyebrow: "THE WINE",
    title: "The cellar",
    description: "A home for wines as they develop, rest, and find their way.",
    sceneCaption: "Inside the cellar",
    objects: [
      {
        id: "cellar-barrels",
        label: "Barrel row",
        icon: "barrel",
        category: "IN THE CELLAR",
        description: "A place for wine to develop over time.",
        detail: "Storage, vessels, and wine development can be explored together here.",
        fields: ["Vessels", "Storage conditions", "Development"],
      },
      {
        id: "cellar-shelves",
        label: "Bottle shelves",
        icon: "shelves",
        category: "IN THE CELLAR",
        description: "A place for the wines in your collection.",
        detail: "The cellar will bring bottled wine and inventory into view.",
        fields: ["Collection", "Inventory", "Wine history"],
      },
      {
        id: "cellar-wine",
        label: "Wine details",
        icon: "bottle",
        category: "THE WINE",
        description: "See the different parts of a wine's story.",
        detail: "Explore a focused view of origin, development, sensory expression, and context.",
        fields: ["Identity & origin", "Sensory expression", "Commercial context"],
      },
    ],
  },
  company: {
    label: "Company",
    eyebrow: "THE BIG PICTURE",
    title: "Your company",
    description: "The places, people, and progress behind your wine.",
    sceneCaption: "A view of the company",
    objects: [
      {
        id: "company-portfolio",
        label: "Estate portfolio",
        icon: "estate",
        category: "THE COMPANY",
        description: "A home for the places that make up your company.",
        detail: "Each estate can be understood as its own place within the wider company.",
        fields: ["Places", "Portfolio", "Connections"],
      },
      {
        id: "company-landmark",
        label: "Landmark",
        icon: "landmark",
        category: "THE COMPANY",
        description: "A little space for the story of your company.",
        detail: "A landmark can give the company overview a sense of place.",
        fields: ["Company identity", "History", "Milestones"],
      },
      {
        id: "company-milestones",
        label: "Milestones",
        icon: "spark",
        category: "THE COMPANY",
        description: "A place to reflect on the journey so far.",
        detail: "Company achievements and history can be brought together here.",
        fields: ["Achievements", "History", "Progress"],
      },
    ],
  },
};

export const navigation: { id: Destination; label: string; icon: IconName }[] = [
  { id: "estate", label: "Estate", icon: "estate" },
  { id: "winery", label: "Winery", icon: "winery" },
  { id: "cellar", label: "Cellar", icon: "cellar" },
  { id: "company", label: "Company", icon: "company" },
  { id: "management", label: "Management", icon: "management" },
];

export const managementSections: {
  id: ManagementSection;
  label: string;
  icon: IconName;
  description: string;
  panels: { title: string; description: string }[];
}[] = [
  {
    id: "finance",
    label: "Finance",
    icon: "finance",
    description: "A clearer view of the resources behind your winery.",
    panels: [
      { title: "Financial overview", description: "A place for the company's financial position." },
      { title: "Cash flow", description: "A place to understand money moving through the business." },
      { title: "Plans & commitments", description: "A place for future commitments and decisions." },
    ],
  },
  {
    id: "market",
    label: "Contracts / Market",
    icon: "market",
    description: "The connections that bring your wines to the world.",
    panels: [
      { title: "Contracts", description: "A place to review agreements and their details." },
      { title: "Markets", description: "A place to explore the markets connected to your wines." },
      { title: "Relationships", description: "A place for the people and businesses you work with." },
    ],
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: "equipment",
    description: "The tools and vessels that support the work of the winery.",
    panels: [
      { title: "Equipment overview", description: "A place to see equipment and vessels together." },
      { title: "Equipment details", description: "A place for the details of a selected item." },
      { title: "Capacity", description: "A place to understand available space and equipment." },
    ],
  },
  {
    id: "people",
    label: "People / Work",
    icon: "people",
    description: "The people and shared work behind every wine.",
    panels: [
      { title: "People", description: "A place for the people and teams of the company." },
      { title: "Work", description: "A place to see work across the estate and winery." },
      { title: "Team overview", description: "A place to understand how people work together." },
    ],
  },
];
