import { lazy, Suspense } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

// Create a wrapper for lazy loaded components with error boundary
const createLazyComponent = (importFunc, fallback = <LoadingSpinner />) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );
};

// Lazy load heavy components
export const Dashboard = createLazyComponent(
  () => import(/* webpackChunkName: "dashboard" */ '../pages/Dashboard')
);

export const AppointmentCalendar = createLazyComponent(
  () => import(/* webpackChunkName: "calendar" */ '../components/AppointmentCalendar')
);

export const PatientPortal = createLazyComponent(
  () => import(/* webpackChunkName: "patient-portal" */ '../pages/PatientPortal')
);

export const Analytics = createLazyComponent(
  () => import(/* webpackChunkName: "analytics" */ '../pages/Analytics')
);

export const PhoneInterface = createLazyComponent(
  () => import(/* webpackChunkName: "phone-interface" */ '../components/PhoneInterface')
);

export const AdminPanel = createLazyComponent(
  () => import(/* webpackChunkName: "admin" */ '../pages/AdminPanel')
);

export const TreatmentPlans = createLazyComponent(
  () => import(/* webpackChunkName: "treatment" */ '../pages/TreatmentPlans')
);

export const Reports = createLazyComponent(
  () => import(/* webpackChunkName: "reports" */ '../pages/Reports')
);

// Preload critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used soon
  import(/* webpackChunkName: "dashboard" */ '../pages/Dashboard');
  import(/* webpackChunkName: "calendar" */ '../components/AppointmentCalendar');
};

// Route-based code splitting configuration
export const routes = [
  {
    path: '/',
    component: Dashboard,
    preload: true
  },
  {
    path: '/appointments',
    component: AppointmentCalendar,
    preload: true
  },
  {
    path: '/patients',
    component: PatientPortal,
    preload: false
  },
  {
    path: '/analytics',
    component: Analytics,
    preload: false
  },
  {
    path: '/phone',
    component: PhoneInterface,
    preload: false
  },
  {
    path: '/admin',
    component: AdminPanel,
    preload: false
  },
  {
    path: '/treatments',
    component: TreatmentPlans,
    preload: false
  },
  {
    path: '/reports',
    component: Reports,
    preload: false
  }
];

// Intersection Observer for lazy loading images
export const lazyLoadImages = () => {
  const images = document.querySelectorAll('img[data-lazy]');
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.lazy;
        img.removeAttribute('data-lazy');
        imageObserver.unobserve(img);
      }
    });
  });
  
  images.forEach(img => imageObserver.observe(img));
};

// Utility for dynamic imports with retry logic
export const dynamicImportWithRetry = async (importFunc, retries = 3) => {
  try {
    return await importFunc();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Failed to load module, retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return dynamicImportWithRetry(importFunc, retries - 1);
    }
    throw error;
  }
};

export default {
  createLazyComponent,
  preloadCriticalComponents,
  routes,
  lazyLoadImages,
  dynamicImportWithRetry
};