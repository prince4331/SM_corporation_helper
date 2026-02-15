# SM Corporation Helper

A professional web application for generating Chalans, Bills, and Quotations for SM Corporation.

## Features

- **Chalan Generator**: Create delivery chalans with item details, origin, and packaging information
- **Bill Generator**: Generate bills with pricing and amount calculations
- **Quotation Generator**: Create professional quotations with terms and conditions
- **PDF Export**: Download documents as PDF files
- **Print Support**: Print-ready documents
- **Local Storage**: Save and retrieve generated documents

## Live Demo

The application is deployed on GitHub Pages and can be accessed at:
**https://prince4331.github.io/sm-corporation-helper/**

## Deployment

This application is automatically deployed to GitHub Pages using GitHub Actions.

### Automatic Deployment

The application is configured with a GitHub Actions workflow (`.github/workflows/static.yml`) that:
- Triggers on every push to the `main` branch
- Can also be triggered manually from the Actions tab
- Deploys all static files to GitHub Pages

### Manual Deployment

To manually trigger a deployment:
1. Go to the repository on GitHub
2. Click on the "Actions" tab
3. Select "Deploy static content to Pages" workflow
4. Click "Run workflow" button

### GitHub Pages Configuration

To ensure GitHub Pages is properly configured:
1. Go to repository Settings
2. Navigate to "Pages" section (under "Code and automation")
3. Under "Build and deployment":
   - Source: Select "GitHub Actions"
4. Save the configuration

## Local Development

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/prince4331/sm-corporation-helper.git
   cd sm-corporation-helper
   ```

2. Start a local web server:
   ```bash
   # Using Python 3
   python3 -m http.server 8080
   
   # Or using Python 2
   python -m SimpleHTTPServer 8080
   
   # Or using Node.js (if you have http-server installed)
   npx http-server -p 8080
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

## Project Structure

```
sm-corporation-helper/
├── index.html          # Main HTML file
├── styles.css          # Styling
├── app.js              # Application logic
├── logo.png            # Company logo
├── .github/
│   └── workflows/
│       └── static.yml  # GitHub Actions deployment workflow
└── README.md           # This file
```

## Technologies Used

- **HTML5**: Structure and content
- **CSS3**: Styling and responsive design
- **JavaScript**: Application logic and interactivity
- **html2pdf.js**: PDF generation library
- **GitHub Actions**: Automated deployment
- **GitHub Pages**: Hosting

## Browser Compatibility

This application works best on modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge

## Usage

1. **Select Document Type**: Choose between Chalan, Bill, or Quotation
2. **Fill in Details**: Enter customer information and date
3. **Add Items**: Add items with relevant details
4. **Generate**: Click the generate button to preview
5. **Download/Print**: Save as PDF or print the document

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is created for SM Corporation.

## Contact

For issues or questions, please open an issue in the GitHub repository.
