# How to run the Project from GitHub Actions
To begin, make sure you go update your GitHub repository settings to include the necessary secrets for authentication and configuration.
1. **Set Up GitHub Secrets**:
   - Navigate to the GitHub repository.
   - Go to `Settings` > `Secrets and variables` > `Actions`.
   - Click on `New repository secret` and add the following
   - ALPHA_VANTAGE_API_KEY: Your Alpha Vantage API key.
   - AWS_ACCESS_KEY_ID: Your AWS access key ID.
   - AWS_SECRET_ACCESS_KEY: Your AWS secret access key.
   - DB_NAME: name of database (stockpredictor) 
   - DB_USERNAME: database username (stockpredictor
   - DB_PASSWORD: database password
   - AWS_KEY_NAME: Your AWS key pair name.
   - Make sure to save each secret after adding it.
2. **Configure GitHub Actions Environment Variables**:
    - Navigate to the GitHub repository.
    - Go to `Settings` > `Secrets and Variables` > `Actions`.
    - At the top you will see a toggle for Secrets and Variables, click on `Variables`.
    - If not already added, add a n ew repository variable for AWS_REGION with the value of your desired AWS region (e.g., us-east-1).
    - Make sure it gets saved
3. **CRUCIAL: Set the terraform remote state bucket within main.tf**
    - In the `main.tf` file of your repository, locate the `backend "s3"` block.
    - Update the `bucket` attribute to specify the name of your S3 bucket that will be used for storing the Terraform state.
    - Ensure that the S3 bucket exists in your AWS account and has proper permissions set up to allow Terraform to access it.
4. **Deploying The Project**:
    - Once the secrets and variables are set up, navigate to the `Actions` tab in your GitHub repository.
    - Select the workflow you want to run (e.g., `Stock Prediction Deploy Script`).
    - Click Run workflow.
    - Select terraform_apply
    - Click the green `Run workflow` button to start the deployment process.
    - Monitor the workflow run to ensure it completes successfully.
    - The terraform state will be remotely managed in an S3 bucket
5. **Post-Deployment**:
    - After the workflow completes, you will get an output with the url to the cloudfront distribution.
    - Use this URL to access the deployed application, however, after initial deployment, it takes a few minutes for the API to be fully functional 
    - You may run into a 504 accessing the login page, but wait a few minutes and try again (IT WILL REMEDY).
6. **Teardown**:
    - To tear down the deployed infrastructure, you can run the `terraform_destroy` workflow in the same manner as the deployment workflow.
    - This will remove all resources created during the deployment process.