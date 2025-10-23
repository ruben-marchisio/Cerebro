import { messagesRepo, projectsRepo, threadsRepo } from "./repos";
import { initDB } from "./storage/indexedDb";

export const ensureSeed = async (): Promise<void> => {
  await initDB();

  const [projects, globalThreads] = await Promise.all([
    projectsRepo.findAll(),
    threadsRepo.findByProject(null),
  ]);

  if (projects.length > 0 || globalThreads.length > 0) {
    return;
  }

  await projectsRepo.add({ name: "Proyecto Demo" });
  const welcomeThread = await threadsRepo.add({
    projectId: null,
    title: "Bienvenida",
  });

  await messagesRepo.add({
    threadId: welcomeThread.id,
    role: "system",
    content: "¡Bienvenido a Cerebro!",
  });
};
