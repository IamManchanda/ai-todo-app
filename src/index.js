import OpenAI from "openai";
import { eq, ilike } from "drizzle-orm";
import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";
import readlineSync from "readline-sync";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getAllTodos() {
  const todos = await db.select().from(todosTable);
  return todos;
}

async function createTodo(todo) {
  const [result] = await db.insert(todosTable).values({ todo }).returning({
    id: todosTable.id,
  });
  return result.id;
}

async function deleteTodoById(id) {
  await db.delete(todosTable).where(eq(todosTable.id, id));
}

async function searchTodo(search) {
  const todos = await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, `%${search}%`));
  return todos;
}

const tools = {
  getAllTodos,
  createTodo,
  deleteTodoById,
  searchTodo,
};

const SYSTEM_PROMPT = `
You are an AI Todo List Assistant with START, PLAN, ACTION, Observation and Output state.
Wait for the user prompt and first PLAN using available tools.
After planning, Take the action with appropriate tools and wait for Observation based on Action.
Once you get the observations, Return the AI response based on START prompt and observation.

You can manage tasks by adding, viewing, updaing and deleting them.
You must follow the JSON output format.

TODO DB schema:
- id: Int (Primary Key)
- todo: String
- created_at: DateTime
- updated_at: DateTime

Available Tools:
- getAllTodos(): Returns all the todos from database
- createTodo(todo: string): Creates a new todo in the DB and takes todo as a string and returns the ID of the created todo
- deleteTodoById(id: string): Deletes the todo by ID given in the DB
- searchTodo(query: string): Searches for all the todos matching the query using ilike operator

Example:
START
{ "type": "plan", "plan": "Add a task for shopping groceries." }
{ "type": "plan", "plan": "I will try to get more context on what user needs to shop." }
{ "type": "output", "output": "Can you tell me what all items you want to shop for?" }
{ "type": "user", "user": "I want to shop for milk, kurkure, lays and choco." }
{ "type": "plan", "plan": "I will use createTodo to create a new Todo in DB." }
{ "type": "action", "function": "createTodo", "input": "Shop for milk, kurkure, lays and choco" }
{ "type": "observation", "observation": "2" }
{ "type": "output", "output": "Your todo has been added successfully." }
`;

const messages = [
  {
    role: "system",
    content: SYSTEM_PROMPT,
  },
];

while (true) {
  const query = readlineSync.question(">> ");
  const userMessage = {
    type: "user",
    user: query,
  };
  messages.push({ role: "user", content: JSON.stringify(userMessage) });

  while (true) {
    const chat = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      response_format: {
        type: "json_object",
      },
    });

    const result = chat.choices[0].message.content;
    messages.push({ role: "assistant", content: result });

    const action = JSON.parse(result);

    if (action.type === "output") {
      console.log(`🤖: ${action.output}`);
      break;
    } else if (action.type === "action") {
      const fn = tools[action.function];

      if (!fn) {
        throw new Error(`Invalid tool call.`);
      }

      const observation = await fn(action.input);
      const observationMessage = {
        type: "observation",
        observation,
      };
      messages.push({
        role: "developer",
        content: JSON.stringify(observationMessage),
      });
    }
  }
}
