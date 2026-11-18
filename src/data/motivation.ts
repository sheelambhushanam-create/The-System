import type { ThemeMode } from '../types/system';

export interface MotivationalSlide {
  id: string;
  imageUrl: string;
  imageAlt: string;
  quote: string;
  author: string;
  themeFocus: ThemeMode | 'all';
}

export interface WellnessNewsItem {
  id: string;
  category: string;
  readTime: string;
  title: string;
  summary: string;
  takeaway: string;
}

export const MOTIVATIONAL_SLIDES: MotivationalSlide[] = [
  {
    id: 'run-sunrise',
    imageUrl: '/src/assets/images/motivation_morning_run_1794986296665.jpg',
    imageAlt: 'Runner pausing on a sunlit bridge at sunrise before morning training',
    quote:
      'Consistency is not about doing everything perfectly; it is about showing up a little bit every single day.',
    author: 'Daily Focus',
    themeFocus: 'clean',
  },
  {
    id: 'mindful-studio',
    imageUrl: '/src/assets/images/motivation_mindful_yoga_1794986295101.jpg',
    imageAlt: 'Calm mindful breathing practice in a sunlit natural studio',
    quote:
      'Rest is where your body gets stronger. Listen to your energy, eat well, and let progress build naturally.',
    author: 'Calm & Steady',
    themeFocus: 'women',
  },
  {
    id: 'strength-focus',
    imageUrl: '/src/assets/images/motivation_strength_focus_1794986295876.jpg',
    imageAlt: 'Kettlebells and wooden gymnastic rings ready in a strength studio',
    quote:
      'Every set you log, glass of water, and healthy meal is a vote for a stronger you ninety days from now.',
    author: 'Keep Going',
    themeFocus: 'rpg',
  },
];

export const WELLNESS_NEWS: WellnessNewsItem[] = [
  {
    id: 'news-neat',
    category: 'Daily Movement',
    readTime: '1 min read',
    title: 'A 10-minute walk after eating lowers blood sugar spikes by 22%',
    summary:
      'Studies show that taking a gentle walk right after lunch or dinner helps your muscles soak up extra sugar naturally without tiring you out.',
    takeaway: 'Take an easy 5–10 minute walk after a meal today.',
  },
  {
    id: 'news-protein',
    category: 'Healthy Eating',
    readTime: '1 min read',
    title: 'Spreading protein across breakfast, lunch, and dinner curbs cravings',
    summary:
      'Getting 25–35 g of protein at each meal keeps you fuller much longer and supports steady toning better than saving all your protein for dinner.',
    takeaway: 'Start your morning with curd, eggs, tofu, or dal chilla.',
  },
  {
    id: 'news-sleep',
    category: 'Sleep & Rest',
    readTime: '1 min read',
    title: 'Sleeping 7+ hours keeps afternoon snack cravings away',
    summary:
      'Even two nights of short sleep under 6 hours boosts hunger signals and makes people crave about 300 extra calories of sweet or salty snacks.',
    takeaway: 'Aim to wind down 30 minutes earlier tonight.',
  },
];
