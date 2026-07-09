export interface IndustryGroup {
  category: string;
  items: string[];
}

/**
 * Hand-authored taxonomy (not an ISO dataset — there isn't one for
 * business industries) used to seed the searchable Industry field in
 * onboarding. Grouped by category so the frontend combobox can render
 * cmdk CommandGroup headings; the four standalone entries at the end of
 * the original spec (Startup, Holding Company, Enterprise, Other) are
 * bundled under a catch-all "Other" group since they have no
 * subcategories of their own.
 */
export const INDUSTRY_TAXONOMY: IndustryGroup[] = [
  {
    category: 'Technology',
    items: [
      'Software / SaaS',
      'Artificial Intelligence',
      'Cybersecurity',
      'IT Services',
      'Cloud Computing',
      'Telecommunications',
    ],
  },
  {
    category: 'Sports',
    items: [
      'Sports Club',
      'Sports Academy',
      'Sports Team',
      'Sports League',
      'Sports Federation',
      'Sports Association',
      'Football Club',
      'Basketball Club',
      'Tennis Academy',
      'Golf Club',
      'Swimming Club',
      'Fitness Center',
      'Gym',
      'Personal Trainer',
      'Esports Organization',
    ],
  },
  {
    category: 'Healthcare',
    items: [
      'Hospital',
      'Clinic',
      'Medical Practice',
      'Dental Clinic',
      'Pharmacy',
      'Mental Health',
      'Physiotherapy',
      'Veterinary Clinic',
      'Home Healthcare',
    ],
  },
  {
    category: 'Education',
    items: [
      'School',
      'University',
      'College',
      'Training Center',
      'Online Education',
      'Tutoring',
      'Language School',
      'Childcare',
    ],
  },
  {
    category: 'Retail',
    items: [
      'Retail Store',
      'Supermarket',
      'Convenience Store',
      'Fashion',
      'Luxury Goods',
      'Jewelry',
      'Electronics',
      'Furniture',
      'E-commerce',
    ],
  },
  {
    category: 'Real Estate',
    items: [
      'Real Estate Agency',
      'Property Management',
      'Construction',
      'Architecture',
      'Interior Design',
      'Engineering',
      'Surveying',
    ],
  },
  {
    category: 'Finance',
    items: [
      'Accounting',
      'Bank',
      'Insurance',
      'Investment Firm',
      'Financial Advisor',
      'FinTech',
      'Crypto',
    ],
  },
  {
    category: 'Hospitality',
    items: [
      'Hotel',
      'Restaurant',
      'Cafe',
      'Bakery',
      'Catering',
      'Food Delivery',
      'Travel Agency',
      'Tour Operator',
    ],
  },
  {
    category: 'Automotive',
    items: [
      'Car Dealership',
      'Auto Repair',
      'Car Rental',
      'Transportation',
      'Logistics',
      'Shipping',
      'Fleet Management',
    ],
  },
  {
    category: 'Manufacturing',
    items: [
      'Factory',
      'Industrial Equipment',
      'Food Manufacturing',
      'Packaging',
      'Textiles',
      'Consumer Goods',
    ],
  },
  {
    category: 'Legal',
    items: ['Law Firm', 'Legal Services', 'Compliance', 'Notary'],
  },
  {
    category: 'Media & Marketing',
    items: [
      'Marketing Agency',
      'Advertising',
      'Public Relations',
      'Photography',
      'Videography',
      'Film Production',
      'Music Label',
      'Publishing',
      'Content Creation',
    ],
  },
  {
    category: 'Beauty & Wellness',
    items: ['Salon', 'Spa', 'Barbershop', 'Cosmetics', 'Wellness Center'],
  },
  {
    category: 'Energy',
    items: ['Oil & Gas', 'Renewable Energy', 'Solar', 'Utilities'],
  },
  {
    category: 'Agriculture',
    items: ['Farm', 'Agribusiness', 'Livestock', 'Fisheries'],
  },
  {
    category: 'Government',
    items: ['Government Agency', 'Municipality', 'Public Service'],
  },
  {
    category: 'Non-Profit',
    items: ['NGO', 'Charity', 'Foundation', 'Religious Organization', 'Community Organization'],
  },
  {
    category: 'Professional Services',
    items: [
      'Consulting',
      'Recruitment',
      'Human Resources',
      'Virtual Assistant',
      'Freelancer',
      'Business Services',
    ],
  },
  {
    category: 'Creative',
    items: [
      'Graphic Design',
      'UX/UI Design',
      'Animation',
      'Game Development',
      'Architecture Studio',
    ],
  },
  {
    category: 'Events',
    items: ['Event Planning', 'Conference Organizer', 'Wedding Planner', 'Entertainment'],
  },
  {
    category: 'Home Services',
    items: ['Cleaning', 'Electrical', 'Plumbing', 'HVAC', 'Landscaping', 'Security Services'],
  },
  {
    category: 'Other',
    items: ['Startup', 'Holding Company', 'Enterprise', 'Other'],
  },
];
