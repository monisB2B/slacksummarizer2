require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { subDays, subHours, subMinutes } = require('date-fns');

// Initialize Prisma client
const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('Starting database seeding...');
  
  try {
    // First, clear any existing data to avoid duplicates
    console.log('Clearing existing data...');
    await prisma.message.deleteMany({});
    await prisma.summary.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.conversation.deleteMany({});
    
    // Create some channels (conversations)
    console.log('Creating channels...');
    const generalChannel = await prisma.conversation.create({
      data: {
        slack_id: 'C0123456789',
        name: 'general',
        type: 'channel',
        createdAt: subDays(new Date(), 90),
        updatedAt: new Date(),
      }
    });
    
    const randomChannel = await prisma.conversation.create({
      data: {
        slack_id: 'C9876543210',
        name: 'random',
        type: 'channel',
        createdAt: subDays(new Date(), 90),
        updatedAt: new Date(),
      }
    });
    
    const projectChannel = await prisma.conversation.create({
      data: {
        slack_id: 'C5555555555',
        name: 'project-xyz',
        type: 'channel',
        createdAt: subDays(new Date(), 45),
        updatedAt: new Date(),
      }
    });
    
    // Add a new channel with recent activity
    const techChannel = await prisma.conversation.create({
      data: {
        slack_id: 'C6666666666',
        name: 'tech-talk',
        type: 'channel',
        createdAt: subDays(new Date(), 10),
        updatedAt: new Date(),
      }
    });
    
    // Create some users
    console.log('Creating users...');
    const users = await Promise.all([
      prisma.user.create({
        data: {
          slack_id: 'U0001',
          name: 'john.doe',
          real_name: 'John Doe',
          email: 'john.doe@example.com',
          is_bot: false
        }
      }),
      prisma.user.create({
        data: {
          slack_id: 'U0002',
          name: 'jane.smith',
          real_name: 'Jane Smith',
          email: 'jane.smith@example.com',
          is_bot: false
        }
      }),
      prisma.user.create({
        data: {
          slack_id: 'U0003',
          name: 'bob.jones',
          real_name: 'Bob Jones',
          email: 'bob.jones@example.com',
          is_bot: false
        }
      }),
      prisma.user.create({
        data: {
          slack_id: 'U0004',
          name: 'slackbot',
          real_name: 'Slackbot',
          is_bot: true
        }
      })
    ]);
    
    // Create messages and threads
    console.log('Creating messages and threads...');
    
    // Function to create a message
    async function createMessage(channelId, userId, text, timestamp, threadTs = null) {
      return prisma.message.create({
        data: {
          channel_id: channelId,
          user_id: userId,
          ts: timestamp.getTime().toString(),
          text: text,
          thread_ts: threadTs,
          permalink: `https://example.slack.com/archives/${channelId}/${timestamp.getTime()}`,
          mentions: threadTs ? [users[1].slack_id] : [],
          createdAt: timestamp
        }
      });
    }
    
    // Create messages in general channel
    const generalMessages = [];
    
    // Day 1 (58 days ago)
    let day1 = subDays(new Date(), 58);
    generalMessages.push(await createMessage(
      generalChannel.id, 
      users[0].slack_id, 
      "Good morning everyone! Let's have a productive day.", 
      day1
    ));
    
    generalMessages.push(await createMessage(
      generalChannel.id,
      users[1].slack_id,
      "Morning! Does anyone know when the new project kickoff is?",
      subMinutes(day1, -30)
    ));
    
    const threadTimestamp = subMinutes(day1, -45).getTime().toString();
    
    generalMessages.push(await createMessage(
      generalChannel.id,
      users[2].slack_id,
      "I think it's next Monday at 10am. @jane.smith can you confirm?",
      subMinutes(day1, -45),
      threadTimestamp
    ));
    
    generalMessages.push(await createMessage(
      generalChannel.id,
      users[1].slack_id,
      "Thanks for the mention. Yes, it's confirmed for Monday at 10am in the main conference room.",
      subMinutes(day1, -50),
      threadTimestamp
    ));
    
    // Day 2 (40 days ago)
    let day2 = subDays(new Date(), 40);
    
    generalMessages.push(await createMessage(
      generalChannel.id,
      users[0].slack_id,
      "Team, please remember to submit your weekly reports by EOD.",
      day2
    ));
    
    // Project channel messages
    const projectMessages = [];
    
    // Day 1 (35 days ago)
    let projectDay1 = subDays(new Date(), 35);
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[0].slack_id,
      "Welcome to the new project channel! We'll use this to coordinate all project XYZ activities.",
      projectDay1
    ));
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[1].slack_id,
      "Great! I've prepared some initial designs. Let me know what you think.",
      subMinutes(projectDay1, -60)
    ));
    
    const projectThreadTs = subMinutes(projectDay1, -90).getTime().toString();
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[2].slack_id,
      "I have a few questions about the requirements. Can we schedule a quick call?",
      subMinutes(projectDay1, -90),
      projectThreadTs
    ));
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[0].slack_id,
      "Sure, how about tomorrow at 2pm?",
      subMinutes(projectDay1, -100),
      projectThreadTs
    ));
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[2].slack_id,
      "Perfect, I'll send a calendar invite.",
      subMinutes(projectDay1, -110),
      projectThreadTs
    ));
    
    // Recent activity (5 days ago)
    let recentDay = subDays(new Date(), 5);
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[1].slack_id,
      "Team, I've just pushed the latest updates to the staging environment. Please test and provide feedback.",
      recentDay
    ));
    
    const recentThreadTs = subMinutes(recentDay, -15).getTime().toString();
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[0].slack_id,
      "Great work! I'll test it this afternoon.",
      subMinutes(recentDay, -15),
      recentThreadTs
    ));
    
    // Create messages for today and yesterday in various channels
    console.log('Creating recent messages (within past 7 days)...');
    
    // Today - General channel
    let today = new Date();
    generalMessages.push(await createMessage(
      generalChannel.id,
      users[0].slack_id,
      "Good morning team! Weekly standup is in 30 minutes.",
      today
    ));
    
    generalMessages.push(await createMessage(
      generalChannel.id,
      users[1].slack_id,
      "I'll be there! Just finishing up the monthly report.",
      subHours(today, 1)
    ));
    
    // Yesterday - General channel
    let yesterday = subDays(today, 1);
    generalMessages.push(await createMessage(
      generalChannel.id,
      users[2].slack_id,
      "Reminder: Please submit your expense reports by end of week.",
      yesterday
    ));
    
    // Yesterday - Project channel
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[1].slack_id,
      "The client feedback is in! They love the new design.",
      yesterday
    ));
    
    const yesterdayThreadTs = subHours(yesterday, 1).getTime().toString();
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[0].slack_id,
      "That's great news! Let's discuss next steps.",
      subHours(yesterday, 1),
      yesterdayThreadTs
    ));
    
    projectMessages.push(await createMessage(
      projectChannel.id,
      users[2].slack_id,
      "I think we should schedule a planning session for phase 2.",
      subHours(yesterday, 0.5),
      yesterdayThreadTs
    ));
    
    // 2-3 days ago - Tech channel
    let threeDaysAgo = subDays(today, 3);
    const techMessages = [];
    
    techMessages.push(await createMessage(
      techChannel.id,
      users[0].slack_id,
      "Has anyone worked with the new GraphQL API yet?",
      threeDaysAgo
    ));
    
    const techThreadTs = subHours(threeDaysAgo, 0.5).getTime().toString();
    
    techMessages.push(await createMessage(
      techChannel.id,
      users[2].slack_id,
      "Yes, I've been using it for the past week. It's much more efficient than the REST API.",
      subHours(threeDaysAgo, 0.5),
      techThreadTs
    ));
    
    techMessages.push(await createMessage(
      techChannel.id,
      users[1].slack_id,
      "Can you share some examples of your queries?",
      subHours(threeDaysAgo, 0.3),
      techThreadTs
    ));
    
    techMessages.push(await createMessage(
      techChannel.id,
      users[2].slack_id,
      "Sure, I'll put together a document with some examples and best practices.",
      subHours(threeDaysAgo, 0.2),
      techThreadTs
    ));
    
    // 4 days ago - Random channel
    let fourDaysAgo = subDays(today, 4);
    
    const randomMessages = [];
    randomMessages.push(await createMessage(
      randomChannel.id,
      users[1].slack_id,
      "Happy Friday everyone! Any fun weekend plans?",
      fourDaysAgo
    ));
    
    randomMessages.push(await createMessage(
      randomChannel.id,
      users[0].slack_id,
      "Going hiking with the family. Weather looks perfect!",
      subHours(fourDaysAgo, -1)
    ));
    
    randomMessages.push(await createMessage(
      randomChannel.id,
      users[2].slack_id,
      "I'm attending a tech conference. Should be interesting!",
      subHours(fourDaysAgo, -2)
    ));
    
    // Create summaries
    console.log('Creating summaries...');
    
    // General channel summary (30 days ago)
    await prisma.summary.create({
      data: {
        channel_id: generalChannel.id,
        period_start: subDays(new Date(), 60),
        period_end: subDays(new Date(), 30),
        summary: "The general channel was relatively quiet this period with discussions mainly focused on the new project kickoff scheduled for Monday at 10am. Team members were reminded to submit weekly reports.",
        highlights: JSON.stringify([
          { text: "New project kickoff confirmed for Monday at 10am in the main conference room" },
          { text: "Weekly reports due by EOD" }
        ]),
        tasks: JSON.stringify([
          { text: "Submit weekly reports", assigned: "all" },
          { text: "Prepare for project kickoff", assigned: "team" }
        ]),
        mentions: JSON.stringify([
          { user: "jane.smith", count: 1 }
        ]),
        createdAt: subDays(new Date(), 30)
      }
    });
    
    // Project channel summary (7 days ago)
    await prisma.summary.create({
      data: {
        channel_id: projectChannel.id,
        period_start: subDays(new Date(), 37),
        period_end: subDays(new Date(), 7),
        summary: "The project channel was established and initial activities began. Jane shared design drafts, and Bob had questions about requirements which were addressed in a meeting. The team is making progress with regular updates.",
        highlights: JSON.stringify([
          { text: "Channel created for coordinating project XYZ activities" },
          { text: "Initial designs were shared by Jane Smith" },
          { text: "Requirements clarification meeting scheduled" }
        ]),
        tasks: JSON.stringify([
          { text: "Review initial designs", assigned: "team" },
          { text: "Attend requirements clarification call", assigned: "Bob Jones" }
        ]),
        mentions: JSON.stringify([]),
        createdAt: subDays(new Date(), 7)
      }
    });
    
    // Recent project summary (1 day ago)
    await prisma.summary.create({
      data: {
        channel_id: projectChannel.id,
        period_start: subDays(new Date(), 7),
        period_end: subDays(new Date(), 1),
        summary: "Updates have been pushed to the staging environment and team members are testing the implementation. Overall progress is on track for the upcoming milestone.",
        highlights: JSON.stringify([
          { text: "Latest updates pushed to staging environment" },
          { text: "Testing phase initiated" }
        ]),
        tasks: JSON.stringify([
          { text: "Test staging environment and provide feedback", assigned: "team" },
          { text: "Prepare for next milestone", assigned: "team" }
        ]),
        mentions: JSON.stringify([]),
        createdAt: subDays(new Date(), 1)
      }
    });
    
    console.log('Database seeding completed successfully!');
    const totalMessages = generalMessages.length + projectMessages.length + randomMessages.length + techMessages.length;
    console.log(`Created ${totalMessages} messages across ${4} channels`);
    console.log('Recent messages summary:');
    console.log(`- General channel: ${generalMessages.filter(m => new Date(m.createdAt) >= subDays(new Date(), 7)).length} messages in past 7 days`);
    console.log(`- Project channel: ${projectMessages.filter(m => new Date(m.createdAt) >= subDays(new Date(), 7)).length} messages in past 7 days`);
    console.log(`- Random channel: ${randomMessages.length} messages in past 7 days`);
    console.log(`- Tech channel: ${techMessages.length} messages in past 7 days`);
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase()
  .then(() => console.log('Done!'))
  .catch(console.error);