// Update this page (the content is just a fallback if you fail to update the page)
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Welcome to Your Blank App</h1>
        <p className="text-xl text-muted-foreground">Start building your amazing project here!</p>
        <Link to="/auth" aria-label="Sign in to Roomrs portal">
          <Button>Sign in</Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;
