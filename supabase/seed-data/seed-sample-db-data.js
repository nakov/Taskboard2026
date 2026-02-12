import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local file
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase env vars. Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sample users to register
const users = [
  { email: 'steve@gmail.com', password: 'pass123', name: 'Steve' },
  { email: 'maria@gmail.com', password: 'pass123', name: 'Maria' },
  { email: 'peter@gmail.com', password: 'pass123', name: 'Peter' }
];

// Default stages for projects
const defaultStages = [
  { name: 'Not Started', position: 0 },
  { name: 'In Progress', position: 1 },
  { name: 'Done', position: 2 }
];

// Project templates
const projectTemplates = [
  {
    title: 'Website Redesign',
    description: 'Complete redesign of company website with modern UI/UX',
    tasks: [
      { title: 'Research competitor websites', description: 'Analyze 5 top competitor websites', stage: 'Done' },
      { title: 'Create wireframes', description: 'Design wireframes for all main pages', stage: 'Done' },
      { title: 'Design homepage mockup', description: 'Create high-fidelity mockup for homepage', stage: 'In Progress' },
      { title: 'Design about page', description: 'Create about page design', stage: 'In Progress' },
      { title: 'Implement responsive navigation', description: 'Code mobile-friendly navigation menu', stage: 'In Progress' },
      { title: 'Build contact form', description: 'Create and test contact form functionality', stage: 'Not Started' },
      { title: 'Optimize images', description: 'Compress and optimize all images', stage: 'Not Started' },
      { title: 'SEO optimization', description: 'Implement SEO best practices', stage: 'Not Started' },
      { title: 'Cross-browser testing', description: 'Test on Chrome, Firefox, Safari, Edge', stage: 'Not Started' },
      { title: 'Deploy to production', description: 'Deploy website to hosting server', stage: 'Not Started' }
    ]
  },
  {
    title: 'Mobile App Development',
    description: 'Develop cross-platform mobile application for iOS and Android',
    tasks: [
      { title: 'Define app requirements', description: 'Document all functional requirements', stage: 'Done' },
      { title: 'Create user flow diagrams', description: 'Map out user journey and flows', stage: 'Done' },
      { title: 'Design UI screens', description: 'Create all screen designs in Figma', stage: 'Done' },
      { title: 'Set up development environment', description: 'Configure React Native environment', stage: 'In Progress' },
      { title: 'Implement authentication', description: 'Build login and registration flow', stage: 'In Progress' },
      { title: 'Create home screen', description: 'Develop main dashboard screen', stage: 'In Progress' },
      { title: 'Implement push notifications', description: 'Set up Firebase push notifications', stage: 'Not Started' },
      { title: 'Add offline support', description: 'Implement offline data caching', stage: 'Not Started' },
      { title: 'Performance optimization', description: 'Optimize app performance and load times', stage: 'Not Started' },
      { title: 'Submit to app stores', description: 'Submit app to Apple App Store and Google Play', stage: 'Not Started' },
      { title: 'Create marketing materials', description: 'Design app screenshots and description', stage: 'Not Started' }
    ]
  },
  {
    title: 'Marketing Campaign Q1',
    description: 'Plan and execute Q1 marketing campaign across all channels',
    tasks: [
      { title: 'Define campaign goals', description: 'Set KPIs and success metrics', stage: 'Done' },
      { title: 'Identify target audience', description: 'Create detailed buyer personas', stage: 'Done' },
      { title: 'Develop campaign messaging', description: 'Create compelling copy and taglines', stage: 'In Progress' },
      { title: 'Design social media graphics', description: 'Create visuals for Facebook, Instagram, LinkedIn', stage: 'In Progress' },
      { title: 'Set up email campaigns', description: 'Create email sequences in Mailchimp', stage: 'In Progress' },
      { title: 'Launch Google Ads', description: 'Create and launch Google Ads campaign', stage: 'Not Started' },
      { title: 'Launch Facebook Ads', description: 'Set up Facebook advertising campaign', stage: 'Not Started' },
      { title: 'Create blog content', description: 'Write 5 blog posts for campaign', stage: 'Not Started' },
      { title: 'Partner outreach', description: 'Contact potential partnership opportunities', stage: 'Not Started' },
      { title: 'Monitor campaign metrics', description: 'Track and report on campaign performance', stage: 'Not Started' },
      { title: 'Optimize campaigns', description: 'Adjust campaigns based on performance data', stage: 'Not Started' },
      { title: 'Create final report', description: 'Compile results and lessons learned', stage: 'Not Started' }
    ]
  },
  {
    title: 'Office Space Renovation',
    description: 'Renovate and modernize office workspace for better productivity',
    tasks: [
      { title: 'Assess current space', description: 'Document existing office layout and issues', stage: 'Done' },
      { title: 'Survey employee needs', description: 'Collect feedback from all team members', stage: 'Done' },
      { title: 'Hire interior designer', description: 'Research and select design professional', stage: 'Done' },
      { title: 'Create floor plan', description: 'Design new office layout and zones', stage: 'In Progress' },
      { title: 'Select furniture', description: 'Choose ergonomic desks and chairs', stage: 'In Progress' },
      { title: 'Order equipment', description: 'Purchase all furniture and equipment', stage: 'Not Started' },
      { title: 'Schedule contractors', description: 'Book electrician and painter', stage: 'Not Started' },
      { title: 'Clear and prepare space', description: 'Pack up and relocate items', stage: 'Not Started' },
      { title: 'Execute renovation', description: 'Complete all construction work', stage: 'Not Started' },
      { title: 'Install new furniture', description: 'Set up all new office furniture', stage: 'Not Started' },
      { title: 'Set up technology', description: 'Install monitors, cables, and equipment', stage: 'Not Started' }
    ]
  }
];

// Helper function to create user
async function createUser(email, password, name) {
  console.log(`\n📝 Registering user: ${email}`);

  try {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!signInError && signInData?.user) {
      console.log(`   ℹ️  User ${email} already exists, using existing account...`);
      await supabase.auth.signOut();
      return signInData.user;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });

    if (signUpError) {
      throw signUpError;
    }

    const createdUser = signUpData?.user ?? null;
    if (createdUser) {
      console.log(`   ✅ User ${email} created successfully`);
    }

    await supabase.auth.signOut();
    return createdUser;
  } catch (error) {
    console.error(`   ❌ Error creating user ${email}:`, error.message);
    return null;
  }
}

// Helper function to create project with stages and tasks
async function createProjectForUser(userId, email, projectTemplate) {
  console.log(`\n📁 Creating project "${projectTemplate.title}" for ${email}`);

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: 'pass123'
    });

    if (signInError) {
      throw signInError;
    }

    const { data: existingProject, error: existingProjectError } = await supabase
      .from('projects')
      .select('id, title')
      .eq('owner_id', userId)
      .eq('title', projectTemplate.title)
      .maybeSingle();

    if (existingProjectError) {
      throw existingProjectError;
    }

    if (existingProject) {
      console.log(`   ℹ️  Project already exists: ${existingProject.title}, skipping...`);
      return;
    }

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        title: projectTemplate.title,
        description: projectTemplate.description,
        owner_id: userId
      })
      .select()
      .single();

    if (projectError) {
      throw projectError;
    }

    console.log(`   ✅ Project created: ${project.title}`);

    // Create stages
    const stagesData = defaultStages.map(stage => ({
      project_id: project.id,
      name: stage.name,
      position: stage.position
    }));

    const { data: stages, error: stagesError } = await supabase
      .from('project_stages')
      .insert(stagesData)
      .select();

    if (stagesError) {
      throw stagesError;
    }

    console.log(`   ✅ Created ${stages.length} stages`);

    // Create a map of stage names to IDs
    const stageMap = {};
    stages.forEach(stage => {
      stageMap[stage.name] = stage.id;
    });

    // Create tasks
    const tasksData = projectTemplate.tasks.map((task, index) => ({
      project_id: project.id,
      stage_id: stageMap[task.stage],
      title: task.title,
      description: task.description,
      position: index,
      done: task.stage === 'Done'
    }));

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .insert(tasksData)
      .select();

    if (tasksError) {
      throw tasksError;
    }

    console.log(`   ✅ Created ${tasks.length} tasks`);

  } catch (error) {
    console.error(`   ❌ Error creating project:`, error.message);
  } finally {
    await supabase.auth.signOut();
  }
}

// Main seed function
async function seed() {
  console.log('\n🌱 Starting database seed...\n');
  console.log('=' .repeat(60));

  // Step 1: Create users
  console.log('\n🔹 STEP 1: Creating users');
  console.log('=' .repeat(60));

  const createdUsers = [];
  for (const user of users) {
    const createdUser = await createUser(user.email, user.password, user.name);
    if (createdUser) {
      createdUsers.push({ ...user, id: createdUser.id });
    }
  }

  console.log(`\n✅ Successfully processed ${createdUsers.length} users`);

  if (createdUsers.length === 0) {
    throw new Error('No users were created or found. Seeding cannot continue.');
  }

  // Step 2: Create projects
  console.log('\n🔹 STEP 2: Creating projects with stages and tasks');
  console.log('=' .repeat(60));

  // Distribute projects among users
  for (let i = 0; i < projectTemplates.length; i++) {
    const user = createdUsers[i % createdUsers.length]; // Distribute evenly
    await createProjectForUser(user.id, user.email, projectTemplates[i]);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   • Users: ${createdUsers.length}`);
  console.log(`   • Projects: ${projectTemplates.length}`);
  console.log(`   • Stages per project: ${defaultStages.length}`);
  console.log(`   • Tasks per project: ~${projectTemplates[0].tasks.length}`);
  console.log('\n💡 You can now log in with any of these accounts:');
  users.forEach(user => {
    console.log(`   • ${user.email} / ${user.password}`);
  });
  console.log('\n');
}

// Run the seed
seed()
  .then(() => {
    console.log('✨ Seed script finished.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Seed script failed:', error);
    process.exit(1);
  });
