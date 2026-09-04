GRC CAFE - Dinner & Dessert Pre-Order System

This repository contains the source code for a lightweight, mobile-friendly Web App designed for managing weekly dinner and dessert pre-orders for GRC CAFE. It integrates a frontend built with HTML and Tailwind CSS with a backend powered by Google Apps Script and Google Sheets.

Features
Dynamic Menu Configuration: Parses weekly menu options, prices, and daily item order limits directly from a Google Sheet backend.

Interactive Ordering Interface: Supports multi-item selection for Friday dinner, Saturday dinner, and Saturday special desserts with real-time total calculation.

Order Tracking & Query Modal: Allows customers to query their active pre-order history by entering their name.

PWA & Mobile Support: Includes a Web App Manifest and service worker capabilities with custom iOS and Android installation prompts.

Social Sharing: Quick sharing integration for WhatsApp, Messenger, and native device share sheets.

Automated Data Management: Google Apps Script backend featuring automatic weekly archiving and order clearing tasks.

Project Structure
GRC.html: The core frontend single-page application built with Tailwind CSS and vanilla JavaScript.

Google API.txt: The Google Apps Script backend handling GET requests (config parsing and order queries), POST requests (order submissions), and weekly automated archiving.
