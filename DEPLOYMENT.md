# Deployment Guide for SM Corporation Helper

## Prerequisites

Before deploying, ensure:
1. You have admin access to the GitHub repository
2. GitHub Pages is enabled in repository settings

## Step-by-Step Deployment Instructions

### 1. Enable GitHub Pages

1. Navigate to your repository on GitHub: `https://github.com/prince4331/sm-corporation-helper`
2. Click on **Settings** (gear icon in the top menu)
3. In the left sidebar, scroll down to **Code and automation** section
4. Click on **Pages**
5. Under **Build and deployment**:
   - **Source**: Select **GitHub Actions** (not "Deploy from a branch")
6. Click **Save** if prompted

### 2. Verify Workflow File

The repository includes a GitHub Actions workflow file at:
```
.github/workflows/static.yml
```

This workflow:
- Automatically deploys on push to `main` branch
- Can be manually triggered from Actions tab
- Uses official GitHub Pages deployment actions

### 3. Trigger Deployment

#### Option A: Automatic Deployment (Recommended)
Simply merge this PR to the `main` branch. The workflow will automatically:
1. Run on push to `main`
2. Build and deploy the site to GitHub Pages
3. The site will be available at: `https://prince4331.github.io/sm-corporation-helper/`

#### Option B: Manual Deployment
1. Go to the **Actions** tab in your repository
2. Select **"Deploy static content to Pages"** workflow
3. Click **"Run workflow"** button
4. Select the `main` branch
5. Click **"Run workflow"** to start deployment

### 4. Verify Deployment

After deployment completes (usually takes 1-2 minutes):
1. Go to **Actions** tab to see deployment status
2. Once successful (green checkmark), visit: `https://prince4331.github.io/sm-corporation-helper/`
3. Test the application functionality:
   - Try generating a Chalan
   - Try generating a Bill
   - Try generating a Quotation
   - Test PDF download
   - Test print functionality

### 5. Monitor Deployment Status

To check deployment status:
1. Go to **Actions** tab
2. Click on the latest workflow run
3. Check the job status and logs
4. Look for any errors in the deployment steps

## Troubleshooting

### Issue: GitHub Pages not showing the site

**Solution:**
1. Verify GitHub Pages is enabled in Settings → Pages
2. Ensure "Source" is set to "GitHub Actions"
3. Check that workflow ran successfully in Actions tab
4. Wait a few minutes for DNS propagation

### Issue: Workflow not running

**Solution:**
1. Check that the workflow file is in `.github/workflows/` directory
2. Verify the workflow is enabled in Actions tab
3. Check branch name matches `main` in workflow file
4. Ensure repository has GitHub Pages enabled

### Issue: 404 Error on deployed site

**Solution:**
1. Verify `index.html` is in the root directory
2. Check workflow uploaded the correct path (`path: '.'`)
3. Clear browser cache and try again
4. Check Actions logs for upload errors

### Issue: Assets (CSS/JS/Images) not loading

**Solution:**
1. Verify all files (styles.css, app.js, logo.png) are in root directory
2. Check that paths in HTML are relative (not absolute)
3. Clear browser cache
4. Check browser console for 404 errors

## Post-Deployment Checklist

- [ ] Site is accessible at GitHub Pages URL
- [ ] All pages load correctly
- [ ] CSS styling is applied
- [ ] JavaScript functionality works
- [ ] Images load properly
- [ ] Chalan generation works
- [ ] Bill generation works
- [ ] Quotation generation works
- [ ] PDF download works
- [ ] Print functionality works
- [ ] Responsive design works on mobile

## Updating the Deployed Site

To update the deployed site:
1. Make changes to your code
2. Commit and push to `main` branch
3. Workflow automatically deploys updates
4. Changes will be live in 1-2 minutes

## Custom Domain (Optional)

To use a custom domain:
1. Go to Settings → Pages
2. Under "Custom domain", enter your domain
3. Configure DNS settings with your domain provider
4. Add CNAME record pointing to: `prince4331.github.io`
5. Save and wait for DNS propagation (up to 24 hours)

## Support

If you encounter issues:
1. Check the Actions tab for deployment logs
2. Review this troubleshooting guide
3. Open an issue in the repository
4. Contact the repository maintainer

## Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Deploying to GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
